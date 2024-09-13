import { system, world, Player, ItemTypes, ItemStack, ItemDurabilityComponent, ItemEnchantableComponent } from '@minecraft/server';
import { ChestFormData } from './extensions/forms.js';  // Adjust the path to ChestFormData

// Event listener for right-clicking the compass
world.afterEvents.itemUse.subscribe(event => {
    if (event.itemStack.typeId === 'minecraft:compass') {
        showPlayerSelectionMenu(event.source);
    }
});

// Function to show the player selection screen
function showPlayerSelectionMenu(player) {
    const onlinePlayers = Array.from(world.getPlayers());

    const chestForm = new ChestFormData('9')
        .title('§l§aSelect a Player')
        .button(8, '§l§eCancel', ['§r§7Exit the menu'], 'textures/blocks/barrier');

    // Add buttons for each online player with their player name and a default head icon
    onlinePlayers.forEach((targetPlayer, index) => {
        chestForm.button(index, `§l§b${targetPlayer.name}`, ['§r§7Click to view inventory'], 'textures/entity/steve');  // Replace 'steve' with appropriate player head if possible
    });

    chestForm.show(player, false).then(response => {  // Disable hotbar
        if (response.canceled || response.selection === 8) return;  // Exit if canceled
        const selectedPlayer = onlinePlayers[response.selection];
        showPlayerInventory(player, selectedPlayer);
    });
}
// Function to get enchantments from an item
function GetEnchants(itemStack) {
    if (!itemStack || !itemStack.hasComponent(ItemEnchantableComponent.componentId)) {
        return [];
    }
    const enchantmentsComponent = itemStack.getComponent(ItemEnchantableComponent.componentId);
    return enchantmentsComponent.getEnchantments().map(enchant => ({
        type: enchant.type.id,
        level: enchant.level
    }));
}

// Function to show the selected player's inventory
function showPlayerInventory(viewer, targetPlayer) {
    const chestForm = new ChestFormData('large').title(`§l§a${targetPlayer.name}'s Inventory`);

    const inventory = targetPlayer.getComponent('inventory').container;

    for (let i = 0; i < inventory.size; i++) {
        const item = inventory.getItem(i);
        if (item) {
            const itemDetails = [];
            const enchantments = GetEnchants(item);
            const lore = item.getLore();
            itemDetails.push(lore.length > 0 ? `§r§7Lore: ${lore.join(', ')}` : '§r§7Lore: None');
            itemDetails.push(enchantments.length > 0 ? `§r§7Enchants: ${enchantments.map(e => `${e.type} ${e.level}`).join(', ')}` : '§r§7Enchants: None');
            const durabilityComponent = item.getComponent('minecraft:durability');
            if (durabilityComponent) {
                const durability = durabilityComponent.maxDurability - durabilityComponent.damage;
                itemDetails.push(`§r§7Durability: ${durability} / ${durabilityComponent.maxDurability}`);
            }
            itemDetails.push(`§r§7NameTag: ${item.nameTag || 'None'}`);
            chestForm.button(i, `§l§b${item.typeId}`, [`§r§7Amount: ${item.amount}`, ...itemDetails], item.typeId);
        } else {
            chestForm.button(i, `§l§7Empty Slot ${i + 1}`, ['§r§7No item in this slot'], 'textures/blocks/barrier');
        }
    }

    // Add additional buttons
    chestForm.button(53, '§l§dView Armor and Offhand', ['§r§7Click to view equipment'], 'minecraft:diamond_chestplate');
    chestForm.button(51, '§l§6View Ender Chest', ['§r§7Click to view Ender Chest'], 'minecraft:ender_chest');
    chestForm.button(52, '§l§eRefresh', ['§r§7Refresh the inventory'], 'textures/ui/refresh.png');

    chestForm.show(viewer).then(response => {
        if (response.canceled) return;

        if (response.selection === 53) {
            showPlayerEquipment(viewer, targetPlayer);
        } else if (response.selection === 51) {
            showEnderChest(viewer, targetPlayer);
        } else if (response.selection === 52) {
            showPlayerInventory(viewer, targetPlayer);
        } else {
            takeItemFromInventory(viewer, targetPlayer, inventory, response.selection);
        }
    });
}
function showEnderChest(viewer, targetPlayer) {
    const chestForm = new ChestFormData('large').title(`§l§a${targetPlayer.name}'s Ender Chest`);

    // Iterate through Ender Chest slots using the `testfor` command
    for (let i = 0; i < 27; i++) {  // Ender Chest has 27 slots
        let foundItem = false;

        // Example item types to check (you should expand this with all possible items)
        const itemsToCheck = [
            'minecraft:diamond', 'minecraft:gold_ingot', 'minecraft:iron_sword', 'minecraft:bread',
            'minecraft:diamond_chestplate', 'minecraft:emerald', 'minecraft:enchanted_book'
        ];

        // Go through every quantity for every item in the Ender Chest slots
        for (const item of itemsToCheck) {
            for (let quantity = 1; quantity <= 64; quantity++) {
                const testCommand = `/testfor @a[name=${targetPlayer.name}, hasitem=[{item=${item},location=slot.enderchest,slot=${i},quantity=${quantity}}]]`;
                const result = viewer.runCommand(testCommand);
                if (result.successCount > 0) {
                    chestForm.button(i, `§l§b${item}`, [`§r§7Amount: ${quantity}`], item);
                    foundItem = true;
                    break;
                }
            }
            if (foundItem) break;
        }

        // If no item was found for the slot, mark it as empty
        if (!foundItem) {
            chestForm.button(i, `§l§7Empty Slot ${i + 1}`, ['§r§7No item in this slot'], 'textures/blocks/barrier');
        }
    }

    // Add a back button to go back to the inventory view
    chestForm.button(52, '§l§eBack to Inventory', ['§r§7Return to inventory view'], 'textures/ui/arrow_dark_right.png');
    // Add a refresh button
    chestForm.button(53, '§l§eRefresh', ['§r§7Refresh the Ender Chest'], 'textures/ui/refresh.png');

    chestForm.show(viewer).then(response => {
        if (response.canceled) return;

        if (response.selection === 52) {
            showPlayerInventory(viewer, targetPlayer);
        } else if (response.selection === 53) {
            showEnderChest(viewer, targetPlayer);
        } else {
            // Remove item from Ender Chest
            const itemSlot = response.selection;
            const item = targetPlayer.getComponent('inventory').container.getItem(itemSlot);
            if (item) {
                const command = `/replaceitem entity @a[name=${targetPlayer.name}] slot.enderchest ${itemSlot} air`;
                viewer.runCommand(command);
                viewer.sendMessage(`§fSystem > §aRemoved '${item.typeId}' from the Ender Chest.`);
            }
        }
    });
}
// Function to show the selected player's armor and offhand items
function showPlayerEquipment(viewer, targetPlayer) {
    const equipmentForm = new ChestFormData('9').title(`§l§a${targetPlayer.name}'s Equipment`);

    const equippable = targetPlayer.getComponent("equippable");

    // Retrieve armor and offhand items
    const headArmor = equippable.getEquipment("Head");
    const chestArmor = equippable.getEquipment("Chest");
    const legArmor = equippable.getEquipment("Legs");
    const footArmor = equippable.getEquipment("Feet");
    const offhandItem = equippable.getEquipment("Offhand");
    const mainhandItem = equippable.getEquipment("Mainhand");

    const armorTypes = ['Helmet', 'Chestplate', 'Leggings', 'Boots'];
    const armorItems = [headArmor, chestArmor, legArmor, footArmor];

    // Function to get detailed info about an item
    function getItemDetails(itemStack) {
        const details = [];
        if (itemStack) {
            // Get item lore
            const lore = itemStack.getLore();
            details.push(lore.length > 0 ? `§r§7Lore: ${lore.join(', ')}` : '§r§7Lore: None');

            // Get item enchantments
            const enchantments = GetEnchants(itemStack);
            if (enchantments.length > 0) {
                const enchantmentsDescription = enchantments.map(enchant => `${enchant.type} ${enchant.level}`).join(', ');
                details.push(`§r§7Enchants: ${enchantmentsDescription}`);
            } else {
                details.push('§r§7Enchants: None');
            }

            // Get item durability
            const durabilityComponent = itemStack.getComponent('durability');
            if (durabilityComponent) {
                const durability = durabilityComponent.maxDurability - durabilityComponent.damage;
                details.push(`§r§7Durability: ${durability} / ${durabilityComponent.maxDurability}`);
            }
        }
        return details;
    }

    // Add armor items with details and indicate empty slots
    for (let i = 0; i < armorItems.length; i++) {
        const armorItem = armorItems[i];
        if (armorItem) {
            const itemDetails = getItemDetails(armorItem);
            const isEnchanted = GetEnchants(armorItem).length > 0;
            equipmentForm.button(i, `§l§b${armorItem.typeId}`, [
                `§r§7Amount: ${armorItem.amount}`,
                ...itemDetails  // Include lore, enchantments, and durability
            ], armorItem.typeId, armorItem.amount, isEnchanted ? 'enchanted' : undefined);
        } else {
            equipmentForm.button(i, `§l§7Empty ${armorTypes[i]}`, ['§r§7No armor in this slot'], 'textures/blocks/barrier');
        }
    }

    // Add mainhand and offhand items with details
    if (mainhandItem) {
        const itemDetails = getItemDetails(mainhandItem);
        const isEnchanted = GetEnchants(mainhandItem).length > 0;
        equipmentForm.button(4, `§l§b${mainhandItem.typeId}`, [
            `§r§7Amount: ${mainhandItem.amount}`,
            ...itemDetails  // Include lore, enchantments, and durability
        ], mainhandItem.typeId, mainhandItem.amount, isEnchanted ? 'enchanted' : undefined);
    } else {
        equipmentForm.button(4, '§l§7Empty Mainhand', ['§r§7No item in mainhand'], 'textures/blocks/barrier');
    }

    if (offhandItem) {
        const itemDetails = getItemDetails(offhandItem);
        const isEnchanted = GetEnchants(offhandItem).length > 0;
        equipmentForm.button(5, `§l§b${offhandItem.typeId}`, [
            `§r§7Amount: ${offhandItem.amount}`,
            ...itemDetails  // Include lore, enchantments, and durability
        ], offhandItem.typeId, offhandItem.amount, isEnchanted ? 'enchanted' : undefined);
    } else {
        equipmentForm.button(5, '§l§7Empty Offhand', ['§r§7No item in offhand'], 'textures/blocks/barrier');
    }

    // Add a back button to go back to the inventory view
    equipmentForm.button(7, '§l§eBack to Inventory', ['§r§7Return to inventory view'], 'textures/ui/arrow_dark_right.png');
    // Add a refresh button
    equipmentForm.button(8, '§l§eRefresh', ['§r§7Refresh the equipment'], 'textures/ui/refresh.png');

    // Show the form to the player
    equipmentForm.show(viewer, true).then(response => {  // Enable hotbar
        if (response.canceled) return;

        if (response.selection >= 0 && response.selection <= 3) {
            // Handle armor item selection
            replaceArmor(viewer, targetPlayer, equippable, response.selection);
        } else if (response.selection === 4) {
            replaceMainhand(viewer, targetPlayer, mainhandItem);
        } else if (response.selection === 5) {
            replaceOffhand(viewer, targetPlayer, offhandItem);
        } else if (response.selection === 7) {
            showPlayerInventory(viewer, targetPlayer);  // Back to inventory
        } else if (response.selection === 8) {
            showPlayerEquipment(viewer, targetPlayer);  // Refresh equipment
        }
    });
}
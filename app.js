import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const SUPABASE_URL = "https://gvpussbazyxvzqrnuzai.supabase.co";
const SUPABASE_KEY = "sb_publishable_RKLPpZ-sHvsl54GnPDup9A_X2KLI2ZY";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const tableContainer = document.getElementById("prices-container");
const searchInput = document.getElementById("search");
const addStoreBtn = document.getElementById("add-store-btn");
const addItemBtn = document.getElementById("add-item-btn");

let priceMatrix = [];
let allStores = [];

// ------------------- Load price matrix -------------------
async function loadPriceMatrix() {
    try {        
        // luam toate preturile cu join pe items si stores
        const { data, error } = await supabase
            .from("prices")
            .select(`
                amount,
                items ( id, name, unit ),
                stores ( id, name )
            `);

        if (error) {
            console.error(error);
            return;
        }

        // reconstruim priceMatrix
        const grouped = {};

        data.forEach(row => {
            const itemId = row.items.id;

            if (!grouped[itemId]) {
                grouped[itemId] = {
                    itemId: row.items.id,
                    itemName: row.items.name,
                    unit: row.items.unit,
                    prices: {}
                };
            }

            grouped[itemId].prices[row.stores.name] = row.amount;
        });

        // convertim la array
        priceMatrix = Object.values(grouped);

        // extragem lista de magazine
        allStores = [
            ...new Set(
                data.map(row => row.stores.name)
            )
        ];

        renderTable(priceMatrix);
    } catch (err) {
        tableContainer.innerHTML = "<p style='color:red;'>Failed to load prices</p>";
        console.error(err);
    }
}

// ------------------- Confirm Delete Item Scroll orizontal -------------------
let confirmCallback = null;

function showConfirm(message, onConfirm) {
    document.getElementById("confirm-text").innerText = message;
    confirmCallback = onConfirm;
    document.getElementById("confirm-modal").classList.remove("hidden");
}

document.getElementById("confirm-cancel").onclick = () => {
    document.getElementById("confirm-modal").classList.add("hidden");
};

document.getElementById("confirm-ok").onclick = () => {
    if (confirmCallback) confirmCallback();
    document.getElementById("confirm-modal").classList.add("hidden");
};

// ------------------- Render tabel -------------------
function renderTable(data) {
    tableContainer.innerHTML = "";

    const table = document.createElement("table");
    table.style.width = "100%";
    table.style.borderCollapse = "collapse";

    // Header
    const header = table.insertRow();   

    // --- Item header ---
    let th = document.createElement("th");
    th.innerText = "Item";
    th.style.border = "1px solid #ccc";
    th.style.padding = "5px";
    header.appendChild(th);
    
    // --- Store headers ---
    allStores.forEach(store => {
        th = document.createElement("th");
        th.style.border = "1px solid #ccc";
        th.style.padding = "5px";
        th.style.textAlign = "left";        

        // container pentru nume + delete
        const div = document.createElement("div");
        div.classList.add("store-header");
        div.style.display = "flex";
        div.style.alignItems = "center";
        div.style.justifyContent = "space-between";

        const span = document.createElement("span");
        span.innerText = store;

        const delBtn = document.createElement("button");
        delBtn.innerText = "✖"; // icon simplu     
        delBtn.classList.add("btn-delete-store");  
        delBtn.title = `Delete store ${store}`;
        delBtn.style.marginLeft = "5px";

        delBtn.addEventListener("click", async () => {
            if (!confirm(`Are you sure you want to delete store "${store}"?`)) return;

            const storeId = await getStoreIdByName(store);
            await deleteStore(storeId);

            // update array allStores și re-render tabel
            allStores = allStores.filter(s => s !== store);
            priceMatrix.forEach(row => delete row.prices[store]); // eliminăm coloana în date
            renderTable(priceMatrix);
        });

        div.appendChild(span);
        div.appendChild(delBtn);
        th.appendChild(div);
        header.appendChild(th);
    });

    // Ultimele coloane fixe: Unit + Actions
    ["Unit", "Actions"].forEach(text => {
        th = document.createElement("th");
        th.innerText = text;
        th.style.border = "1px solid #ccc";
        th.style.padding = "5px";
        header.appendChild(th);
    });
   
    // ----------- ROWS -----------
data.forEach(row => {
    const tr = table.insertRow();
    tr.classList.add("swipe-row");
    tr.style.position = "relative"; // Important for swipe

    // Create the swipe-content div but DON'T put td's inside it
    const swipeContent = document.createElement("div");
    swipeContent.className = "swipe-content";
    swipeContent.style.display = "contents"; // This makes it act like it's not there
    tr.appendChild(swipeContent);

    // ----------------- Item -----------------
    const tdItem = document.createElement("td");
    tdItem.innerText = row.itemName;
    tdItem.style.border = "1px solid #ccc";
    tdItem.style.padding = "5px";
    swipeContent.appendChild(tdItem); // Now it's okay because display:contents

    // ----------------- Prices -----------------
    const prices = allStores.map(s => row.prices[s]).filter(v => v > 0);
    const minPrice = prices.length ? Math.min(...prices) : null;
    const inputs = {};

    allStores.forEach(store => {
        const td = document.createElement("td");
        td.style.border = "1px solid #ccc";
        td.style.padding = "5px";

        const input = document.createElement("input");
        input.type = "text";
        input.inputMode = "decimal";
        input.classList.add("price-input");
        input.value = row.prices[store] ?? 0;
        input.style.width = "60px";
        input.style.textAlign = "center";

        const priceValue = row.prices[store] ?? 0;
        if (minPrice !== null && priceValue === minPrice) {
            td.classList.add("cheapest");
        }

        td.appendChild(input);
        inputs[store] = input;
        swipeContent.appendChild(td);
    });

    // ----------------- Unit -----------------
    const tdUnit = document.createElement("td");
    const select = document.createElement("select");
    ["kg", "item"].forEach(u => {
        const option = document.createElement("option");
        option.value = u;
        option.innerText = u;
        if (row.unit === u) option.selected = true;
        select.appendChild(option);
    });
    tdUnit.appendChild(select);
    tdUnit.style.border = "1px solid #ccc";
    tdUnit.style.padding = "5px";
    swipeContent.appendChild(tdUnit);

    select.addEventListener("change", async () => {
        row.unit = select.value;
        await updateItemUnit(row.itemId, select.value);
    });

    // ----------------- Actions -----------------
    const tdActions = document.createElement("td");
    tdActions.style.border = "1px solid #ccc";
    tdActions.style.padding = "5px";

    const saveBtn = document.createElement("button");
    saveBtn.innerText = "💾 Save";
    saveBtn.classList.add("btn-save");
    saveBtn.style.marginRight = "5px";

    saveBtn.addEventListener("click", async () => {
        for (const store of allStores) {
            const val = parseFloat(inputs[store].value);
            if (isNaN(val) || val < 0) {
                alert(`Price for ${store} must be 0 or positive`);
                inputs[store].value = row.prices[store] ?? 0;
                return;
            }

            const storeId = await getStoreIdByName(store);
            await updatePrice(row.itemId, storeId, val);
            row.prices[store] = val;
        }

        saveBtn.disabled = true;
        saveBtn.innerText = "✔ Saved";

        setTimeout(() => {
            saveBtn.disabled = false;
            saveBtn.innerText = "💾 Save";
            renderTable(priceMatrix);
        }, 1000);
    });
    
    tdActions.appendChild(saveBtn);
    swipeContent.appendChild(tdActions);

    // Swipe Delete
    const swipeDelete = document.createElement("div");
    swipeDelete.className = "swipe-delete";
    swipeDelete.innerText = "🗑️";
    tr.appendChild(swipeDelete);

    enableSwipe(tr, async () => {
        showConfirm(`Delete item "${row.itemName}"?`, async () => {
            await deleteItem(row.itemId);
            priceMatrix = priceMatrix.filter(r => r.itemId !== row.itemId);
            renderTable(priceMatrix);
        });
    });
});

    tableContainer.appendChild(table);
}

// ------------------- ENABLE swipe pe rând -------------------
function enableSwipe(tr, onDelete) {
    let startX = 0;
    let currentX = 0;

    const swipeContent = tr.querySelector(".swipe-content");
    const swipeDelete = tr.querySelector(".swipe-delete");

    if (!swipeContent || !swipeDelete) return;

    tr.addEventListener("touchstart", e => {
        startX = e.touches[0].clientX;
    });

    tr.addEventListener("touchmove", e => {
        currentX = e.touches[0].clientX;
        const diff = currentX - startX;

        if (diff < 0 && diff > -80) {
            swipeContent.style.transform = `translateX(${diff}px)`;
        }
    });

    tr.addEventListener("touchend", () => {
        if (startX - currentX > 50) {
            swipeContent.style.transform = "translateX(-60px)";
        } else {
            swipeContent.style.transform = "translateX(0)";
        }
    });

    swipeDelete.onclick = onDelete;
}

// ------------------- Search filter -------------------
searchInput.addEventListener("input", () => {
    const term = searchInput.value.toLowerCase();
    const filtered = priceMatrix.filter(row =>
        row.itemName.toLowerCase().includes(term)
    );
    renderTable(filtered);
});

// ------------------- Add new store -------------------
addStoreBtn.addEventListener("click", async () => {
    const storeName = prompt("Enter new store name:");
    if (!storeName) return;

    // Inserăm magazinul
    const { data: newStore, error } = await supabase
        .from("stores")
        .insert([{ name: storeName }])
        .select()
        .single();

    if (error) {
        alert("Store already exists or error occurred.");
        console.error(error);
        return;
    }

    // Luăm toate item-urile existente
    const { data: items, error: itemsError } = await supabase
        .from("items")
        .select("id");

    if (itemsError) {
        console.error(itemsError);
        return;
    }

    // Creăm automat rânduri în prices (0 implicit)
    const priceRows = items.map(item => ({
        item_id: item.id,
        store_id: newStore.id,
        amount: 0
    }));

    const { error: priceError } = await supabase
        .from("prices")
        .insert(priceRows);

    if (priceError) {
        console.error(priceError);
        return;
    }

    // Actualizăm UI local
    allStores.push(newStore.name);
    priceMatrix.forEach(row => row.prices[newStore.name] = 0);

    renderTable(priceMatrix);
});

// ------------------- Add new item -------------------
addItemBtn.addEventListener("click", async () => {
    const itemName = prompt("Enter new item name:");
    if (!itemName) return;

    // Inserăm item-ul
    const { data: newItem, error } = await supabase
        .from("items")
        .insert([{ name: itemName, unit: "kg" }])
        .select()
        .single();

    if (error) {
        alert("Item already exists or error occurred.");
        console.error(error);
        return;
    }

    // Luăm toate magazinele existente
    const { data: stores, error: storesError } = await supabase
        .from("stores")
        .select("id, name");

    if (storesError) {
        console.error(storesError);
        return;
    }

    // Creăm automat rânduri în prices (0 implicit)
    const priceRows = stores.map(store => ({
        item_id: newItem.id,
        store_id: store.id,
        amount: 0
    }));

    const { error: priceError } = await supabase
        .from("prices")
        .insert(priceRows);

    if (priceError) {
        console.error(priceError);
        return;
    }

    // Update UI local
    const newRow = {
        itemId: newItem.id,
        itemName: newItem.name,
        unit: newItem.unit,
        prices: {}
    };

    stores.forEach(store => {
        newRow.prices[store.name] = 0;
    });

    priceMatrix.push(newRow);
    renderTable(priceMatrix);
});

// ------------------- Update price -------------------
async function updatePrice(itemId, storeId, amount) {

    const { error } = await supabase
        .from("prices")
        .update({ amount: amount })
        .eq("item_id", itemId)
        .eq("store_id", storeId);

    if (error) {
        console.error("Error updating price:", error);
    }
}

// ------------------- Update unit -------------------
async function updateItemUnit(itemId, unit) {

    const { error } = await supabase
        .from("items")
        .update({ unit: unit })
        .eq("id", Number(itemId));

    if (error) {
        console.error("Error updating unit:", error);
    }
}

// ------------------- Delete item -------------------
async function deleteItem(itemId) {
    if (!confirm("Are you sure you want to delete this item?")) return;

    try {
        const { error } = await supabase
            .from("items")
            .delete()
            .eq("id", Number(itemId));

        if (error) throw error;

        loadPriceMatrix(); // reîncarcă tabelul după ștergere

    } catch (err) {
        console.error(err);
        alert("Failed to delete item.");
    }
}

// ------------------- Delete store -------------------
async function deleteStore(storeId) {
    if (!confirm("Are you sure you want to delete this store?")) return;

    try {
        const { error } = await supabase
            .from("stores")
            .delete()
            .eq("id", Number(storeId));

        if (error) throw error;

        loadPriceMatrix(); // reîncarcă tabelul după ștergere

    } catch (err) {
        console.error(err);
        alert("Failed to delete store.");
    }
}

// ------------------- Helper storeId -------------------
async function getStoreIdByName(name) {
    const { data: stores, error } = await supabase
        .from("stores")
        .select("*");

    if (error) {
        console.error(error);
        return 0;
    }

    const store = stores.find(s => s.name === name);
    return store?.id ?? 0;
}

// ------------------- Initial load -------------------
loadPriceMatrix();
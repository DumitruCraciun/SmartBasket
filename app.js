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
    th.innerText = "Produs";
    th.style.border = "1px solid #ddd";
    th.style.padding = "8px 4px";
    th.style.zIndex = "3";
    header.appendChild(th);
    
    // --- Store headers ---
    allStores.forEach(store => {
        th = document.createElement("th");
        th.style.border = "1px solid #ddd";
        th.style.padding = "8px 4px";
        th.style.textAlign = "left";               

        const div = document.createElement("div");
        div.classList.add("store-header");

        const span = document.createElement("span");
        span.innerText = store;

        const delBtn = document.createElement("button");
        delBtn.innerText = "✕";     
        delBtn.classList.add("btn-delete-store");  
        delBtn.title = `Șterge magazinul ${store}`;

        delBtn.addEventListener("click", async (e) => {
            e.stopPropagation();
            showConfirm(`Sigur ștergi magazinul "${store}"?`, async () => {
                const storeId = await getStoreIdByName(store);
                await deleteStore(storeId);
                allStores = allStores.filter(s => s !== store);
                priceMatrix.forEach(row => delete row.prices[store]);
                renderTable(priceMatrix);
            });
        });

        div.appendChild(span);
        div.appendChild(delBtn);
        th.appendChild(div);
        header.appendChild(th);
    });

    // Ultimele coloane: Unit și Save (pentru mobile)    
    ["Unit", "Save"].forEach(text => {
        th = document.createElement("th");
        th.innerText = text;
        th.style.border = "1px solid #ddd";
        th.style.padding = "8px 4px";
        header.appendChild(th);
    });
   
    // ----------- Rânduri cu produse -----------
    data.forEach(row => {
        const tr = table.insertRow();
        
        // Calcul preț minim
        const prices = allStores.map(s => row.prices[s]).filter(v => v > 0);
        const minPrice = prices.length ? Math.min(...prices) : null;        
        const inputs = {};

        // ----------------- Coloana Produs -----------------
        const tdItem = document.createElement("td");
        tdItem.style.border = "1px solid #ddd";
        tdItem.style.padding = "8px 4px";
        
        const itemDiv = document.createElement("div");
        itemDiv.classList.add("item-header");
        
        const itemSpan = document.createElement("span");
        itemSpan.innerText = row.itemName;
        
        const deleteItemBtn = document.createElement("button");
        deleteItemBtn.innerText = "✕";
        deleteItemBtn.classList.add("btn-delete-item");
        deleteItemBtn.title = `Șterge produsul ${row.itemName}`;
        
        deleteItemBtn.addEventListener("click", async (e) => {
            e.stopPropagation();
            showConfirm(`Ștergi produsul "${row.itemName}"?`, async () => {
                await deleteItem(row.itemId);
                priceMatrix = priceMatrix.filter(r => r.itemId !== row.itemId);
                renderTable(priceMatrix);
            });
        });
        
        itemDiv.appendChild(itemSpan);
        itemDiv.appendChild(deleteItemBtn);
        tdItem.appendChild(itemDiv);
        tr.appendChild(tdItem);

        // ----------------- Coloane prețuri magazine -----------------
        allStores.forEach(store => {
            const td = document.createElement("td");
            td.style.border = "1px solid #ddd";
            td.style.padding = "8px 4px";

            const input = document.createElement("input");
            input.type = "text";
            input.inputMode = "decimal";
            input.classList.add("price-input");
            input.value = row.prices[store] ?? 0;
            
            // Evidențiere preț minim
            const priceValue = row.prices[store] ?? 0;
            if (minPrice !== null && priceValue === minPrice) {
                td.classList.add("cheapest");
            }

            td.appendChild(input);
            inputs[store] = input;
            tr.appendChild(td);
        });

        // ----------------- Coloana Unitate -----------------
        const tdUnit = document.createElement("td");
        tdUnit.style.border = "1px solid #ddd";
        tdUnit.style.padding = "8px 4px";
        tdUnit.style.textAlign = "center";
        
        const select = document.createElement("select");

        // Array de unități cu mapare pentru baza de date
        const displayUnit = ["kg", "buc"];

        displayUnit.forEach(u => {
            const option = document.createElement("option");
            option.value = u; // Valoarea din select va fi "kg" sau "buc"
            option.innerText = u;
            
            // row.unit vine din baza de date: "kg" sau "item"
            // Trebuie să convertim row.unit în valoarea de afișat
            let dbToDisplay = row.unit;
            if (row.unit === "item") {
                dbToDisplay = "buc";
            }
            
            // Setează selected dacă se potrivesc
            if (dbToDisplay === u) {
                option.selected = true;
            }
            
            select.appendChild(option);
        });
        
        //select.addEventListener("change", async () => {
        //    row.unit = select.value;
        //    await updateItemUnit(row.itemId, select.value);
        //});
        
        tdUnit.appendChild(select);
        tr.appendChild(tdUnit);

// ----------------- Coloana Salvare -----------------
        const tdSave = document.createElement("td");
        tdSave.style.border = "1px solid #ddd";
        tdSave.style.padding = "8px 4px";
        tdSave.style.textAlign = "center";
        
        const saveBtn = document.createElement("button");
        saveBtn.innerText = "💾 Save";   
        saveBtn.classList.add("btn-save");     
        saveBtn.style.marginRight = "0";
        saveBtn.style.padding = "6px 10px";
        saveBtn.style.fontSize = "0.7rem";
        saveBtn.style.whiteSpace = "nowrap";
        saveBtn.style.width = "100%";
        saveBtn.style.maxWidth = "60px";

        saveBtn.addEventListener("click", async () => {
            
            // Salvează unitatea
            let selectedUnit = select.value; // "kg" sau "buc"
            
            // Convertește "buc" în "item" pentru baza de date
            if (selectedUnit === "buc") {
                selectedUnit = "item";
            }
            if (row.unit !== selectedUnit) {
                console.log("Încerc să salvez unitatea:", { itemId: row.itemId, selectedUnit });
                
                // Salvează în baza de date
                const { data, error } = await supabase
                    .from("items")
                    .update({ unit: selectedUnit })
                    .eq("id", Number(row.itemId))
                    .select();
                    
                if (error) {
                    console.error("Eroare detaliată la salvarea unității:", error);
                    console.log("Detalii eroare:", {
                        message: error.message,
                        details: error.details,
                        hint: error.hint,
                        code: error.code
                    });
                    alert(`Eroare la salvarea unității: ${error.message}`);
                    return;
                }
                
                console.log("Unitate salvată cu succes:", data);
                
                // Actualizează și în priceMatrix
                row.unit = selectedUnit;
            }
            
            // Salvează prețurile
            for (const store of allStores) {
                const val = parseFloat(inputs[store].value);
                if (isNaN(val) || val < 0) {
                    alert(`Prețul pentru ${store} trebuie să fie 0 sau mai mare`);
                    inputs[store].value = row.prices[store] ?? 0;
                    return;
                }

                const storeId = await getStoreIdByName(store);
                await updatePrice(row.itemId, storeId, val);
                row.prices[store] = val;
            }

            // Feedback vizual pentru butonul Save
            saveBtn.disabled = true;
            saveBtn.innerText = "✓ Salvat";
            saveBtn.style.background = "#27ae60";

            setTimeout(() => {
                saveBtn.disabled = false;
                saveBtn.innerText = "💾 Save";
                saveBtn.style.background = "#2ecc71";
                // Re-render cu datele actualizate
                renderTable(priceMatrix);
            }, 1000);
        });
        
        tdSave.appendChild(saveBtn);
        tr.appendChild(tdSave);
    });

    tableContainer.appendChild(table);
}

// ------------------- ENABLE swipe pe rând -------------------
function enableSwipe(tr, onDelete) {
    let startX = 0;
    let currentX = 0;
    let isSwiped = false;

    const swipeContent = tr.querySelector(".swipe-content");
    const swipeDelete = tr.querySelector(".swipe-delete");

    if (!swipeContent || !swipeDelete) return;

    tr.addEventListener("touchstart", e => {
        startX = e.touches[0].clientX;
        tr.classList.remove("swiped"); // Elimină swipe-ul anterior
    });

    tr.addEventListener("touchmove", e => {
        currentX = e.touches[0].clientX;
        const diff = currentX - startX;

        if (diff < 0 && diff > -60) {
            swipeDelete.style.right = `${-60 - diff}px`;
        }
    });

    tr.addEventListener("touchend", () => {
        const diff = currentX - startX;
        
        if (diff < -30) {
            tr.classList.add("swiped");
            swipeDelete.style.right = "0";
            isSwiped = true;
        } else {
            tr.classList.remove("swiped");
            swipeDelete.style.right = "-60px";
            isSwiped = false;
        }
    });

    swipeDelete.onclick = (e) => {
        e.stopPropagation();
        onDelete();
        tr.classList.remove("swiped");
        swipeDelete.style.right = "-60px";
    };
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
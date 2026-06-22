/**
 * ===================================================================
 * POS MERCHANDISE - GOOGLE APPS SCRIPT BACKEND
 * ===================================================================
 * Cara pakai:
 * 1. Buat Google Sheet baru
 * 2. Buka menu Extensions > Apps Script
 * 3. Hapus semua kode default, paste seluruh isi file ini
 * 4. Jalankan fungsi "setupSheets" sekali (lihat panduan)
 * 5. Deploy sebagai Web App (Execute as: Me, Who has access: Anyone)
 * 6. Copy URL Web App ke website POS
 * ===================================================================
 */

// ====== NAMA-NAMA SHEET ======
const SHEET_PRODUCTS = 'Products';
const SHEET_BUNDLES = 'Bundles';
const SHEET_TRANSACTIONS = 'Transactions';
const SHEET_TRANSACTION_ITEMS = 'TransactionItems';
const SHEET_CATEGORIES = 'Categories';
const SHEET_PURCHASES = 'Purchases';

// ===================================================================
// SETUP - Jalankan fungsi ini SEKALI saja dari editor Apps Script
// ===================================================================
function setupSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // --- Sheet Categories ---
  let sh = ss.getSheetByName(SHEET_CATEGORIES);
  if (!sh) sh = ss.insertSheet(SHEET_CATEGORIES);
  sh.clear();
  sh.appendRow(['CategoryID', 'CategoryName']);
  sh.appendRow(['CAT-001', 'Pakaian']);
  sh.appendRow(['CAT-002', 'Aksesoris']);

  // --- Sheet Products ---
  sh = ss.getSheetByName(SHEET_PRODUCTS);
  if (!sh) sh = ss.insertSheet(SHEET_PRODUCTS);
  sh.clear();
  sh.appendRow(['ProductID', 'ProductName', 'CategoryID', 'PriceUmum', 'PriceKaryawan', 'Stock', 'IsActive']);

  // --- Sheet Bundles (header produk bundling) ---
  sh = ss.getSheetByName(SHEET_BUNDLES);
  if (!sh) sh = ss.insertSheet(SHEET_BUNDLES);
  sh.clear();
  sh.appendRow(['BundleID', 'BundleName', 'PriceUmum', 'PriceKaryawan', 'IsActive', 'ComponentsJSON']);
  // ComponentsJSON contoh: [{"productId":"PRD-001","qty":1},{"productId":"PRD-002","qty":2}]

  // --- Sheet Transactions (header transaksi) ---
  sh = ss.getSheetByName(SHEET_TRANSACTIONS);
  if (!sh) sh = ss.insertSheet(SHEET_TRANSACTIONS);
  sh.clear();
  sh.appendRow(['TransactionID', 'DateTime', 'CustomerType', 'PaymentMethod', 'TotalAmount', 'Notes', 'AffectsStock']);

  // --- Sheet TransactionItems (detail per item) ---
  sh = ss.getSheetByName(SHEET_TRANSACTION_ITEMS);
  if (!sh) sh = ss.insertSheet(SHEET_TRANSACTION_ITEMS);
  sh.clear();
  sh.appendRow(['TransactionID', 'ItemType', 'ItemID', 'ItemName', 'Qty', 'UnitPrice', 'Subtotal', 'ComponentsJSON']);

  // --- Sheet Purchases (pengeluaran/pembelian barang) ---
  sh = ss.getSheetByName(SHEET_PURCHASES);
  if (!sh) sh = ss.insertSheet(SHEET_PURCHASES);
  sh.clear();
  sh.appendRow(['PurchaseID', 'DateTime', 'Description', 'Amount', 'Wallet', 'Notes']);

  // Hapus sheet default "Sheet1" jika masih ada dan kosong
  const defaultSheet = ss.getSheetByName('Sheet1');
  if (defaultSheet) ss.deleteSheet(defaultSheet);

  SpreadsheetApp.getUi().alert('Setup selesai! Sheet sudah siap dipakai.');
}

// ===================================================================
// ENTRY POINTS WEB APP
// ===================================================================
function doGet(e) {
  try {
    const action = e.parameter.action;
    let result;

    switch (action) {
      case 'getAllData':
        result = getAllData();
        break;
      case 'getProducts':
        result = getProducts();
        break;
      case 'getCategories':
        result = getCategories();
        break;
      case 'getBundles':
        result = getBundles();
        break;
      case 'getSalesSummary':
        result = getSalesSummary(e.parameter.startDate, e.parameter.endDate);
        break;
      case 'getFinancialSummary':
        result = getFinancialSummary();
        break;
      default:
        result = { error: 'Unknown action: ' + action };
    }
    return jsonResponse(result);
  } catch (err) {
    return jsonResponse({ error: err.toString() });
  }
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const action = body.action;
    let result;

    switch (action) {
      case 'addProduct':
        result = addProduct(body.data);
        break;
      case 'updateProduct':
        result = updateProduct(body.data);
        break;
      case 'deleteProduct':
        result = deleteProduct(body.data.productId);
        break;
      case 'adjustStock':
        result = adjustStock(body.data.productId, body.data.delta);
        break;
      case 'addCategory':
        result = addCategory(body.data);
        break;
      case 'addBundle':
        result = addBundle(body.data);
        break;
      case 'updateBundle':
        result = updateBundle(body.data);
        break;
      case 'deleteBundle':
        result = deleteBundle(body.data.bundleId);
        break;
      case 'checkout':
        result = processCheckout(body.data);
        break;
      case 'updateTransaction':
        result = updateTransaction(body.data);
        break;
      case 'deleteTransaction':
        result = deleteTransaction(body.data.transactionId);
        break;
      case 'addPurchase':
        result = addPurchase(body.data);
        break;
      case 'deletePurchase':
        result = deletePurchase(body.data.purchaseId);
        break;
      default:
        result = { error: 'Unknown action: ' + action };
    }
    return jsonResponse(result);
  } catch (err) {
    return jsonResponse({ error: err.toString() });
  }
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ===================================================================
// HELPER: Ambil sheet & konversi ke array of objects
// ===================================================================
function sheetToObjects(sheetName) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  const range = sh.getDataRange().getValues();
  if (range.length < 2) return [];
  const headers = range[0];
  const rows = range.slice(1);
  return rows
    .filter(row => row.some(cell => cell !== '' && cell !== null))
    .map(row => {
      const obj = {};
      headers.forEach((h, i) => (obj[h] = row[i]));
      return obj;
    });
}

function getSheet(name) {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
}

function ensureTransactionSchema() {
  const sh = getSheet(SHEET_TRANSACTIONS);
  const lastColumn = Math.max(sh.getLastColumn(), 1);
  const headers = sh.getRange(1, 1, 1, lastColumn).getValues()[0];
  let col = headers.indexOf('AffectsStock') + 1;
  if (col === 0) {
    col = lastColumn + 1;
    sh.getRange(1, col).setValue('AffectsStock');
    if (sh.getLastRow() > 1) sh.getRange(2, col, sh.getLastRow() - 1, 1).setValue(true);
  }
  return col;
}

function ensureTransactionItemSchema() {
  const sh = getSheet(SHEET_TRANSACTION_ITEMS);
  const lastColumn = Math.max(sh.getLastColumn(), 1);
  const headers = sh.getRange(1, 1, 1, lastColumn).getValues()[0];
  if (headers.indexOf('ComponentsJSON') < 0) sh.getRange(1, lastColumn + 1).setValue('ComponentsJSON');
}

function ensureFinanceSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_PURCHASES);
  if (!sh) {
    sh = ss.insertSheet(SHEET_PURCHASES);
    sh.appendRow(['PurchaseID', 'DateTime', 'Description', 'Amount', 'Wallet', 'Notes']);
  }
  return sh;
}

// ===================================================================
// GET ALL DATA (dipanggil saat website pertama load, biar 1x call saja)
// ===================================================================
function getAllData() {
  return {
    products: getProducts(),
    categories: getCategories(),
    bundles: getBundles(),
  };
}

// ===================================================================
// CATEGORIES
// ===================================================================
function getCategories() {
  return sheetToObjects(SHEET_CATEGORIES);
}

function addCategory(data) {
  const sh = getSheet(SHEET_CATEGORIES);
  const id = 'CAT-' + Utilities.getUuid().substring(0, 8).toUpperCase();
  sh.appendRow([id, data.categoryName]);
  return { success: true, categoryId: id };
}

// ===================================================================
// PRODUCTS
// ===================================================================
function getProducts() {
  return sheetToObjects(SHEET_PRODUCTS).filter(p => p.IsActive !== false && p.IsActive !== 'FALSE');
}

function addProduct(data) {
  const sh = getSheet(SHEET_PRODUCTS);
  const id = 'PRD-' + Utilities.getUuid().substring(0, 8).toUpperCase();
  sh.appendRow([
    id,
    data.productName,
    data.categoryId,
    Number(data.priceUmum) || 0,
    Number(data.priceKaryawan) || 0,
    Number(data.stock) || 0,
    true,
  ]);
  return { success: true, productId: id };
}

function updateProduct(data) {
  const sh = getSheet(SHEET_PRODUCTS);
  const range = sh.getDataRange().getValues();
  const headers = range[0];
  const idCol = headers.indexOf('ProductID');

  for (let i = 1; i < range.length; i++) {
    if (range[i][idCol] === data.productId) {
      const rowIndex = i + 1;
      if (data.productName !== undefined) sh.getRange(rowIndex, headers.indexOf('ProductName') + 1).setValue(data.productName);
      if (data.categoryId !== undefined) sh.getRange(rowIndex, headers.indexOf('CategoryID') + 1).setValue(data.categoryId);
      if (data.priceUmum !== undefined) sh.getRange(rowIndex, headers.indexOf('PriceUmum') + 1).setValue(Number(data.priceUmum));
      if (data.priceKaryawan !== undefined) sh.getRange(rowIndex, headers.indexOf('PriceKaryawan') + 1).setValue(Number(data.priceKaryawan));
      if (data.stock !== undefined) sh.getRange(rowIndex, headers.indexOf('Stock') + 1).setValue(Number(data.stock));
      return { success: true };
    }
  }
  return { success: false, error: 'Produk tidak ditemukan' };
}

function deleteProduct(productId) {
  const sh = getSheet(SHEET_PRODUCTS);
  const range = sh.getDataRange().getValues();
  const headers = range[0];
  const idCol = headers.indexOf('ProductID');
  const activeCol = headers.indexOf('IsActive');

  for (let i = 1; i < range.length; i++) {
    if (range[i][idCol] === productId) {
      sh.getRange(i + 1, activeCol + 1).setValue(false);
      return { success: true };
    }
  }
  return { success: false, error: 'Produk tidak ditemukan' };
}

function adjustStock(productId, delta) {
  const sh = getSheet(SHEET_PRODUCTS);
  const range = sh.getDataRange().getValues();
  const headers = range[0];
  const idCol = headers.indexOf('ProductID');
  const stockCol = headers.indexOf('Stock');

  for (let i = 1; i < range.length; i++) {
    if (range[i][idCol] === productId) {
      const currentStock = Number(range[i][stockCol]) || 0;
      const newStock = currentStock + Number(delta);
      sh.getRange(i + 1, stockCol + 1).setValue(newStock);
      return { success: true, newStock: newStock };
    }
  }
  return { success: false, error: 'Produk tidak ditemukan' };
}

// ===================================================================
// BUNDLES
// ===================================================================
function getBundles() {
  const bundles = sheetToObjects(SHEET_BUNDLES).filter(b => b.IsActive !== false && b.IsActive !== 'FALSE');
  return bundles.map(b => {
    let components = [];
    try {
      components = JSON.parse(b.ComponentsJSON || '[]');
    } catch (e) {
      components = [];
    }
    return {
      bundleId: b.BundleID,
      bundleName: b.BundleName,
      priceUmum: b.PriceUmum,
      priceKaryawan: b.PriceKaryawan,
      components: components,
    };
  });
}

function addBundle(data) {
  const sh = getSheet(SHEET_BUNDLES);
  const id = 'BDL-' + Utilities.getUuid().substring(0, 8).toUpperCase();
  sh.appendRow([
    id,
    data.bundleName,
    Number(data.priceUmum) || 0,
    Number(data.priceKaryawan) || 0,
    true,
    JSON.stringify(data.components || []),
  ]);
  return { success: true, bundleId: id };
}

function updateBundle(data) {
  const sh = getSheet(SHEET_BUNDLES);
  const range = sh.getDataRange().getValues();
  const headers = range[0];
  const idCol = headers.indexOf('BundleID');

  for (let i = 1; i < range.length; i++) {
    if (range[i][idCol] === data.bundleId) {
      const rowIndex = i + 1;
      if (data.bundleName !== undefined) sh.getRange(rowIndex, headers.indexOf('BundleName') + 1).setValue(data.bundleName);
      if (data.priceUmum !== undefined) sh.getRange(rowIndex, headers.indexOf('PriceUmum') + 1).setValue(Number(data.priceUmum));
      if (data.priceKaryawan !== undefined) sh.getRange(rowIndex, headers.indexOf('PriceKaryawan') + 1).setValue(Number(data.priceKaryawan));
      if (data.components !== undefined) sh.getRange(rowIndex, headers.indexOf('ComponentsJSON') + 1).setValue(JSON.stringify(data.components));
      return { success: true };
    }
  }
  return { success: false, error: 'Bundle tidak ditemukan' };
}

function deleteBundle(bundleId) {
  const sh = getSheet(SHEET_BUNDLES);
  const range = sh.getDataRange().getValues();
  const headers = range[0];
  const idCol = headers.indexOf('BundleID');
  const activeCol = headers.indexOf('IsActive');

  for (let i = 1; i < range.length; i++) {
    if (range[i][idCol] === bundleId) {
      sh.getRange(i + 1, activeCol + 1).setValue(false);
      return { success: true };
    }
  }
  return { success: false, error: 'Bundle tidak ditemukan' };
}

// ===================================================================
// CHECKOUT - proses transaksi, kurangi stok, catat ke sheet
// ===================================================================
function processCheckout(data) {
  // data = { customerType, paymentMethod, items: [{type, id, name, qty, unitPrice}], notes }
  const lock = LockService.getScriptLock();
  lock.waitLock(30000); // hindari race condition saat banyak transaksi bersamaan

  try {
    const txId = 'TRX-' + new Date().getTime();
    const now = new Date();
    let totalAmount = 0;

    // 1. Validasi & hitung kebutuhan stok produk dasar (termasuk dari bundle)
    const productSh = getSheet(SHEET_PRODUCTS);
    const productRange = productSh.getDataRange().getValues();
    const productHeaders = productRange[0];
    const pIdCol = productHeaders.indexOf('ProductID');
    const pStockCol = productHeaders.indexOf('Stock');

    const stockNeeded = {}; // productId -> total qty yang harus dikurangi

    const allBundles = getBundles();
    const activeProducts = getProducts();
    data.items.forEach(item => {
      if (item.type === 'product') {
        stockNeeded[item.id] = (stockNeeded[item.id] || 0) + Number(item.qty);
      } else if (item.type === 'bundle') {
        const bundle = allBundles.find(b => b.bundleId === item.id);
        if (bundle) {
          const components = Array.isArray(item.components) && item.components.length ? item.components : bundle.components;
          if (components.length !== bundle.components.length) throw new Error('Komponen bundle tidak lengkap');
          components.forEach((comp, index) => {
            if (Number(comp.qty) !== Number(bundle.components[index].qty)) throw new Error('Jumlah komponen bundle tidak valid');
            if (!activeProducts.some(p => p.ProductID === comp.productId)) throw new Error('Produk pengganti tidak ditemukan');
            stockNeeded[comp.productId] = (stockNeeded[comp.productId] || 0) + comp.qty * Number(item.qty);
          });
        } else throw new Error('Bundle tidak ditemukan: ' + item.id);
      }
      totalAmount += Number(item.unitPrice) * Number(item.qty);
    });

    // 2. Cek stok cukup
    for (const productId in stockNeeded) {
      let found = false;
      for (let i = 1; i < productRange.length; i++) {
        if (productRange[i][pIdCol] === productId) {
          found = true;
          const currentStock = Number(productRange[i][pStockCol]) || 0;
          if (currentStock < stockNeeded[productId]) {
            return { success: false, error: 'Stok tidak cukup untuk produk: ' + productId };
          }
        }
      }
      if (!found) {
        return { success: false, error: 'Produk tidak ditemukan: ' + productId };
      }
    }

    // 3. Kurangi stok
    for (const productId in stockNeeded) {
      for (let i = 1; i < productRange.length; i++) {
        if (productRange[i][pIdCol] === productId) {
          const currentStock = Number(productRange[i][pStockCol]) || 0;
          productSh.getRange(i + 1, pStockCol + 1).setValue(currentStock - stockNeeded[productId]);
        }
      }
    }

    // 4. Catat transaksi header
    const txSh = getSheet(SHEET_TRANSACTIONS);
    ensureTransactionSchema();
    txSh.appendRow([txId, now, data.customerType, data.paymentMethod, totalAmount, data.notes || '', true]);

    // 5. Catat detail item
    const itemSh = getSheet(SHEET_TRANSACTION_ITEMS);
    ensureTransactionItemSchema();
    data.items.forEach(item => {
      itemSh.appendRow([
        txId,
        item.type,
        item.id,
        item.name,
        item.qty,
        item.unitPrice,
        Number(item.unitPrice) * Number(item.qty),
        item.type === 'bundle' ? JSON.stringify(item.components || []) : '',
      ]);
    });

    return { success: true, transactionId: txId, totalAmount: totalAmount };
  } finally {
    lock.releaseLock();
  }
}

// ===================================================================
// SALES SUMMARY / REPORT
// ===================================================================
function getSalesSummary(startDate, endDate) {
  const transactions = sheetToObjects(SHEET_TRANSACTIONS);
  const items = sheetToObjects(SHEET_TRANSACTION_ITEMS);
  const products = sheetToObjects(SHEET_PRODUCTS);
  const bundles = getBundles();

  let filteredTx = transactions;
  if (startDate || endDate) {
    const start = startDate ? new Date(startDate + 'T00:00:00') : new Date(0);
    const end = endDate ? new Date(endDate + 'T23:59:59.999') : new Date(8640000000000000);
    filteredTx = transactions.filter(t => {
      const txDate = new Date(t.DateTime);
      return txDate >= start && txDate <= end;
    });
  }

  const txIds = new Set(filteredTx.map(t => t.TransactionID));
  const filteredItems = items.filter(it => txIds.has(it.TransactionID));

  // Total per metode pembayaran
  let totalCash = 0;
  let totalQrisMrBob = 0;
  let totalQrisMerchandise = 0;
  filteredTx.forEach(t => {
    if (t.PaymentMethod === 'cash') totalCash += Number(t.TotalAmount);
    else if (t.PaymentMethod === 'qris' || t.PaymentMethod === 'qris_mrbob') totalQrisMrBob += Number(t.TotalAmount);
    else if (t.PaymentMethod === 'qris_merchandise') totalQrisMerchandise += Number(t.TotalAmount);
  });

  // Ringkasan baris transaksi asli untuk kompatibilitas laporan lama.
  const itemSales = {};
  filteredItems.forEach(it => {
    const key = it.ItemName;
    if (!itemSales[key]) itemSales[key] = { qty: 0, total: 0, type: it.ItemType };
    itemSales[key].qty += Number(it.Qty);
    itemSales[key].total += Number(it.Subtotal);
  });

  const itemSalesArray = Object.keys(itemSales).map(name => ({
    name: name,
    type: itemSales[name].type,
    qty: itemSales[name].qty,
    total: itemSales[name].total,
  }));
  itemSalesArray.sort((a, b) => b.qty - a.qty || String(a.name).localeCompare(String(b.name)));

  // Penjualan barang: pembelian langsung + komponen aktual dari bundle.
  const productSales = {};
  products.filter(p => p.IsActive !== false && p.IsActive !== 'FALSE').forEach(p => {
    productSales[p.ProductID] = { productId: p.ProductID, name: p.ProductName, qty: 0, total: 0, type: 'product' };
  });
  const bundleSales = {};
  bundles.forEach(b => {
    bundleSales[b.bundleId] = { bundleId: b.bundleId, name: b.bundleName, qty: 0, total: 0, type: 'bundle' };
  });

  filteredItems.forEach(it => {
    const soldQty = Number(it.Qty) || 0;
    if (it.ItemType === 'product') {
      if (!productSales[it.ItemID]) productSales[it.ItemID] = { productId: it.ItemID, name: it.ItemName, qty: 0, total: 0, type: 'product' };
      productSales[it.ItemID].qty += soldQty;
      productSales[it.ItemID].total += Number(it.Subtotal) || 0;
      return;
    }
    if (it.ItemType === 'bundle') {
      if (!bundleSales[it.ItemID]) bundleSales[it.ItemID] = { bundleId: it.ItemID, name: it.ItemName, qty: 0, total: 0, type: 'bundle' };
      bundleSales[it.ItemID].qty += soldQty;
      bundleSales[it.ItemID].total += Number(it.Subtotal) || 0;
      const bundle = bundles.find(b => b.bundleId === it.ItemID);
      const actualComponents = parseComponentsJSON(it.ComponentsJSON);
      const components = actualComponents.length ? actualComponents : (bundle ? bundle.components : []);
      components.forEach(comp => {
        const product = products.find(p => p.ProductID === comp.productId);
        if (!productSales[comp.productId]) productSales[comp.productId] = { productId: comp.productId, name: product ? product.ProductName : comp.productId, qty: 0, total: 0, type: 'product' };
        productSales[comp.productId].qty += Number(comp.qty) * soldQty;
      });
    }
  });

  const productSalesArray = Object.values(productSales).sort((a, b) => b.qty - a.qty || String(a.name).localeCompare(String(b.name)));
  const bundleSalesArray = Object.values(bundleSales).sort((a, b) => b.qty - a.qty || String(a.name).localeCompare(String(b.name)));
  const bestSeller = productSalesArray.length > 0 && productSalesArray[0].qty > 0 ? productSalesArray[0] : null;

  const transactionDetails = filteredTx
    .map(t => ({
      transactionId: t.TransactionID,
      dateTime: t.DateTime,
      customerType: t.CustomerType,
      paymentMethod: t.PaymentMethod,
      totalAmount: Number(t.TotalAmount) || 0,
      notes: t.Notes || '',
      items: filteredItems
        .filter(it => it.TransactionID === t.TransactionID)
        .map(it => ({
          type: it.ItemType,
          id: it.ItemID,
          name: it.ItemName,
          qty: Number(it.Qty) || 0,
          unitPrice: Number(it.UnitPrice) || 0,
          components: parseComponentsJSON(it.ComponentsJSON),
        })),
    }))
    .sort((a, b) => new Date(b.dateTime) - new Date(a.dateTime));

  // Sisa stok semua produk
  const stockRemaining = products
    .filter(p => p.IsActive !== false && p.IsActive !== 'FALSE')
    .map(p => ({
      productId: p.ProductID,
      productName: p.ProductName,
      stock: p.Stock,
    }));

  return {
    totalCash: totalCash,
    totalQrisMrBob: totalQrisMrBob,
    totalQrisMerchandise: totalQrisMerchandise,
    totalQris: totalQrisMrBob + totalQrisMerchandise,
    grandTotal: totalCash + totalQrisMrBob + totalQrisMerchandise,
    transactionCount: filteredTx.length,
    itemSales: itemSalesArray,
    productSales: productSalesArray,
    bundleSales: bundleSalesArray,
    bestSeller: bestSeller,
    transactions: transactionDetails,
    stockRemaining: stockRemaining,
  };
}

function normalizeWallet(method) {
  if (method === 'qris' || method === 'qris_mrbob') return 'qris_mrbob';
  if (method === 'qris_merchandise') return 'qris_merchandise';
  return 'cash';
}

function getFinancialSummary() {
  ensureFinanceSheet();
  const transactions = sheetToObjects(SHEET_TRANSACTIONS);
  const purchases = sheetToObjects(SHEET_PURCHASES);
  const income = { cash: 0, qris_mrbob: 0, qris_merchandise: 0 };
  const expenses = { cash: 0, qris_mrbob: 0, qris_merchandise: 0 };

  transactions.forEach(t => {
    const wallet = normalizeWallet(String(t.PaymentMethod || '').toLowerCase());
    income[wallet] += Number(t.TotalAmount) || 0;
  });
  purchases.forEach(p => {
    const wallet = normalizeWallet(String(p.Wallet || '').toLowerCase());
    expenses[wallet] += Number(p.Amount) || 0;
  });

  const balances = {
    cash: income.cash - expenses.cash,
    qris_mrbob: income.qris_mrbob - expenses.qris_mrbob,
    qris_merchandise: income.qris_merchandise - expenses.qris_merchandise,
  };
  return {
    income: income,
    expenses: expenses,
    balances: balances,
    totalBalance: balances.cash + balances.qris_mrbob + balances.qris_merchandise,
    purchases: purchases.map(p => ({
      purchaseId: p.PurchaseID,
      dateTime: p.DateTime,
      description: p.Description,
      amount: Number(p.Amount) || 0,
      wallet: normalizeWallet(String(p.Wallet || '').toLowerCase()),
      notes: p.Notes || '',
    })).sort((a, b) => new Date(b.dateTime) - new Date(a.dateTime)),
  };
}

function addPurchase(data) {
  const validWallets = ['cash', 'qris_mrbob', 'qris_merchandise'];
  const wallet = String(data.wallet || '').toLowerCase();
  const amount = Number(data.amount) || 0;
  if (!data.description || amount <= 0 || !validWallets.includes(wallet)) throw new Error('Data pembelian tidak lengkap');
  const finance = getFinancialSummary();
  if (finance.balances[wallet] < amount) throw new Error('Saldo dompet tidak cukup');

  const sh = ensureFinanceSheet();
  const id = 'BUY-' + new Date().getTime();
  const date = data.date ? new Date(data.date + 'T12:00:00') : new Date();
  sh.appendRow([id, date, data.description, amount, wallet, data.notes || '']);
  return { success: true, purchaseId: id, balance: finance.balances[wallet] - amount };
}

function deletePurchase(purchaseId) {
  const sh = ensureFinanceSheet();
  const values = sh.getDataRange().getValues();
  if (values.length < 2) throw new Error('Pembelian tidak ditemukan');
  const idCol = values[0].indexOf('PurchaseID');
  for (let i = values.length - 1; i >= 1; i--) {
    if (values[i][idCol] === purchaseId) {
      sh.deleteRow(i + 1);
      return { success: true };
    }
  }
  throw new Error('Pembelian tidak ditemukan');
}

function stockNeededForItems(items) {
  const needed = {};
  const bundles = getBundles();
  (items || []).forEach(item => {
    const qty = Number(item.qty) || 0;
    if (item.type === 'product') {
      needed[item.id] = (needed[item.id] || 0) + qty;
    } else if (item.type === 'bundle') {
      const bundle = bundles.find(b => b.bundleId === item.id);
      if (!bundle) throw new Error('Bundle tidak ditemukan: ' + item.id);
      const components = Array.isArray(item.components) && item.components.length ? item.components : bundle.components;
      components.forEach(comp => {
        needed[comp.productId] = (needed[comp.productId] || 0) + Number(comp.qty) * qty;
      });
    }
  });
  return needed;
}

function parseComponentsJSON(value) {
  if (!value) return [];
  try { return JSON.parse(value); } catch (err) { return []; }
}

function updateTransaction(data) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    if (!data.transactionId || !data.items || data.items.length === 0) throw new Error('Data transaksi tidak lengkap');
    const txSh = getSheet(SHEET_TRANSACTIONS);
    const itemSh = getSheet(SHEET_TRANSACTION_ITEMS);
    ensureTransactionSchema();
    const txValues = txSh.getDataRange().getValues();
    const txHeaders = txValues[0];
    const txIdCol = txHeaders.indexOf('TransactionID');
    const txRow = txValues.findIndex((row, i) => i > 0 && row[txIdCol] === data.transactionId);
    if (txRow < 1) throw new Error('Transaksi tidak ditemukan');
    const affectsStockCol = txHeaders.indexOf('AffectsStock');
    const affectsStock = affectsStockCol < 0 || (txValues[txRow][affectsStockCol] !== false && txValues[txRow][affectsStockCol] !== 'FALSE');

    const oldItems = sheetToObjects(SHEET_TRANSACTION_ITEMS)
      .filter(it => it.TransactionID === data.transactionId)
      .map(it => ({ type: it.ItemType, id: it.ItemID, qty: Number(it.Qty) || 0, components: parseComponentsJSON(it.ComponentsJSON) }));
    const oldNeeded = affectsStock ? stockNeededForItems(oldItems) : {};
    const newNeeded = affectsStock ? stockNeededForItems(data.items) : {};

    const productSh = getSheet(SHEET_PRODUCTS);
    const productValues = productSh.getDataRange().getValues();
    const productHeaders = productValues[0];
    const pIdCol = productHeaders.indexOf('ProductID');
    const pStockCol = productHeaders.indexOf('Stock');
    const allIds = new Set(Object.keys(oldNeeded).concat(Object.keys(newNeeded)));
    allIds.forEach(productId => {
      const row = productValues.findIndex((r, i) => i > 0 && r[pIdCol] === productId);
      if (row < 1) throw new Error('Produk tidak ditemukan: ' + productId);
      const available = (Number(productValues[row][pStockCol]) || 0) + (oldNeeded[productId] || 0);
      if (available < (newNeeded[productId] || 0)) throw new Error('Stok tidak cukup untuk produk: ' + productId);
    });
    allIds.forEach(productId => {
      const row = productValues.findIndex((r, i) => i > 0 && r[pIdCol] === productId);
      const current = Number(productValues[row][pStockCol]) || 0;
      productSh.getRange(row + 1, pStockCol + 1).setValue(current + (oldNeeded[productId] || 0) - (newNeeded[productId] || 0));
    });

    const total = data.items.reduce((sum, item) => sum + Number(item.qty) * Number(item.unitPrice), 0);
    txSh.getRange(txRow + 1, txHeaders.indexOf('CustomerType') + 1).setValue(data.customerType);
    txSh.getRange(txRow + 1, txHeaders.indexOf('PaymentMethod') + 1).setValue(data.paymentMethod);
    txSh.getRange(txRow + 1, txHeaders.indexOf('TotalAmount') + 1).setValue(total);
    txSh.getRange(txRow + 1, txHeaders.indexOf('Notes') + 1).setValue(data.notes || '');

    const itemValues = itemSh.getDataRange().getValues();
    const itemIdCol = itemValues[0].indexOf('TransactionID');
    for (let i = itemValues.length - 1; i >= 1; i--) {
      if (itemValues[i][itemIdCol] === data.transactionId) itemSh.deleteRow(i + 1);
    }
    ensureTransactionItemSchema();
    data.items.forEach(item => itemSh.appendRow([
      data.transactionId, item.type, item.id, item.name, Number(item.qty), Number(item.unitPrice), Number(item.qty) * Number(item.unitPrice), item.type === 'bundle' ? JSON.stringify(item.components || []) : '',
    ]));
    return { success: true, totalAmount: total };
  } finally {
    lock.releaseLock();
  }
}

function deleteTransaction(transactionId) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const itemSh = getSheet(SHEET_TRANSACTION_ITEMS);
    const txSh = getSheet(SHEET_TRANSACTIONS);
    ensureTransactionSchema();
    const txValues = txSh.getDataRange().getValues();
    const txIdCol = txValues[0].indexOf('TransactionID');
    const affectsStockCol = txValues[0].indexOf('AffectsStock');
    const txRow = txValues.findIndex((row, i) => i > 0 && row[txIdCol] === transactionId);
    const affectsStock = txRow >= 1 && (affectsStockCol < 0 || (txValues[txRow][affectsStockCol] !== false && txValues[txRow][affectsStockCol] !== 'FALSE'));
    const items = sheetToObjects(SHEET_TRANSACTION_ITEMS)
      .filter(it => it.TransactionID === transactionId)
      .map(it => ({ type: it.ItemType, id: it.ItemID, qty: Number(it.Qty) || 0, components: parseComponentsJSON(it.ComponentsJSON) }));
    const restore = affectsStock ? stockNeededForItems(items) : {};
    const productSh = getSheet(SHEET_PRODUCTS);
    const productValues = productSh.getDataRange().getValues();
    const productHeaders = productValues[0];
    const pIdCol = productHeaders.indexOf('ProductID');
    const pStockCol = productHeaders.indexOf('Stock');
    Object.keys(restore).forEach(productId => {
      const row = productValues.findIndex((r, i) => i > 0 && r[pIdCol] === productId);
      if (row >= 1) productSh.getRange(row + 1, pStockCol + 1).setValue((Number(productValues[row][pStockCol]) || 0) + restore[productId]);
    });

    const itemValues = itemSh.getDataRange().getValues();
    const itemIdCol = itemValues[0].indexOf('TransactionID');
    for (let i = itemValues.length - 1; i >= 1; i--) {
      if (itemValues[i][itemIdCol] === transactionId) itemSh.deleteRow(i + 1);
    }
    for (let i = txValues.length - 1; i >= 1; i--) {
      if (txValues[i][txIdCol] === transactionId) txSh.deleteRow(i + 1);
    }
    return { success: true };
  } finally {
    lock.releaseLock();
  }
}

// ===================================================================
// IMPORT TRANSAKSI LAMA (20–21 Juni 2026) TANPA MENGUBAH STOK
// Jalankan SEKALI dari editor Apps Script setelah deploy kode terbaru.
// Aman dijalankan ulang: TransactionID yang sudah ada akan dilewati.
// ===================================================================
function importHistoricalSalesJune2026() {
  ensureTransactionSchema();
  ensureTransactionItemSchema();
  migrateLegacyQrisToMrBob();
  cleanupHistoricalPicNotes();
  const rows = [
    ['20/06/2026','Kaos Full Doodle Putih - Regular Size',1,110000,'BAYU','QRIS',''],
    ['20/06/2026','Kaos Full Doodle Hitam - Regular Size',1,110000,'BAYU','QRIS',''],
    ['20/06/2026','Notebook Spiral softcover laminasi isi 50 lembar',1,15000,'BAYU','QRIS',''],
    ['20/06/2026','Sticker Anti Air Merah',1,7000,'BAYU','QRIS',''],
    ['20/06/2026','Sticker Anti Air Biru',1,7000,'BAYU','QRIS',''],
    ['20/06/2026','Ganci Mr.BOB Gang B',1,7000,'BAYU','QRIS',''],
    ['20/06/2026','Ganci Im Very Cofident',1,7000,'BAYU','QRIS',''],
    ['20/06/2026','Kipas angin portable - navy',1,60000,'BAYU','QRIS',''],
    ['20/06/2026','Ganci Mr.BOB Gang L',1,7000,'BAYU','QRIS',''],
    ['20/06/2026','Ganci Confident Speaking',1,7000,'BAYU','QRIS',''],
    ['20/06/2026','Ganci Mr.BOB Gang B',1,7000,'BAYU','QRIS',''],
    ['20/06/2026','Ganci Mr.BOB Gang L',1,7000,'BAYU','QRIS',''],
    ['20/06/2026','Ganci Im Very Cofident',1,7000,'BAYU','QRIS',''],
    ['20/06/2026','Ganci Mr.BOB Gang B',1,7000,'BAYU','CASH',''],
    ['20/06/2026','Ganci Mr.BOB Gang L',1,7000,'BAYU','CASH',''],
    ['20/06/2026','Kipas angin portable - navy',1,60000,'AYU','QRIS','Mas Pai'],
    ['20/06/2026','Sticker Anti Air Biru',1,7000,'AYU','QRIS','Mas Pai'],
    ['20/06/2026','Sticker Anti Air Merah',1,7000,'AYU','QRIS','Mas Pai'],
    ['20/06/2026','Ganci Im Very Cofident',1,7000,'AYU','QRIS','Mas Pai'],
    ['20/06/2026','Ganci Mr.BOB Gang B',1,7000,'AYU','QRIS','Mas Pai'],
    ['20/06/2026','Kipas angin portable - navy',1,60000,'ALIN','QRIS',''],
    ['20/06/2026','Kipas angin portable - hitam',1,60000,'ALIN','QRIS',''],
    ['20/06/2026','Notebook Spiral hardcover isi 50 lembar',1,25000,'BAYU','CASH',''],
    ['20/06/2026','Ganci Mr.BOB Gang B',1,7000,'BAYU','CASH',''],
    ['20/06/2026','Ganci Confident Speaking',1,7000,'BAYU','CASH',''],
    ['20/06/2026','Notebook Spiral hardcover isi 50 lembar',1,25000,'BAYU','QRIS','Bayu'],
    ['20/06/2026','Kipas angin portable - hitam',1,60000,'ALIN','QRIS',''],
    ['21/06/2026','Ganci Mr.BOB Gang B',1,7000,'ZAKI','CASH','Bunda RO Jkt'],
    ['21/06/2026','Tumbler Handle 900ml',1,110000,'ZAKI','CASH','Member Gembul'],
    ['21/06/2026','Ganci Confident Speaking',1,7000,'ZAKI','CASH','Member Gembul'],
    ['21/06/2026','Notebook Spiral hardcover isi 50 lembar',1,25000,'ZAKI','CASH','Member Gembul'],
    ['21/06/2026','Tumbler Handle 900ml',1,110000,'ZAKI','CASH','Member Cepak'],
    ['21/06/2026','Ganci Mr.BOB Gang L',1,7000,'ZAKI','QRIS','Sister Cewe Bertopi'],
    ['21/06/2026','Sticker Anti Air Merah',1,7000,'ZAKI','QRIS','Sister Cewe Bertopi'],
    ['21/06/2026','Ganci Mr.BOB Gang B',1,7000,'ZAKI','CASH','Bocil gamau difoto'],
    ['21/06/2026','Kipas angin portable - hitam',1,60000,'ZAKI','CASH','Bocil jombang'],
    ['21/06/2026','Ganci Mr.BOB Gang B',3,7000,'AYU','CASH','Bocil mau daftar'],
    ['21/06/2026','Kaos Full Doodle Hitam - Regular Size',1,110000,'AYU','CASH',''],
    ['21/06/2026','Ganci Im Very Cofident',2,7000,'BAYU','CASH','Preorder hitam logo M'],
    ['21/06/2026','Ganci Im Very Cofident',1,7000,'BAYU','CASH','Bocil'],
    ['21/06/2026','Ganci Confident Speaking',1,7000,'BAYU','CASH','Bocil'],
    ['21/06/2026','Kipas angin portable - hitam',1,60000,'ZAKI','CASH','Bunda'],
    ['21/06/2026','Kipas angin portable - navy',1,60000,'ZAKI','CASH','Bunda'],
    ['21/06/2026','Tumbler Gagang 900ml',1,110000,'ZAKI','QRIS','Peach'],
    ['21/06/2026','Tumbler Handle 900ml',1,110000,'ZAKI','CASH','White'],
    ['21/06/2026','Tumbler Gagang 1200ml',1,125000,'ZAKI','QRIS','Bunda Rambut Kuncir Kuda'],
  ];

  const txSh = getSheet(SHEET_TRANSACTIONS);
  const itemSh = getSheet(SHEET_TRANSACTION_ITEMS);
  const existingIds = new Set(sheetToObjects(SHEET_TRANSACTIONS).map(t => t.TransactionID));
  const products = getProducts();
  const aliases = {
    'Kaos Full Doodle Putih - Regular Size': 'Kaos Doodle Motivasi Putih - Regular Size',
    'Kaos Full Doodle Hitam - Regular Size': 'Kaos Doodle Motivasi Hitam - Regular Size',
  };
  let imported = 0;
  let skipped = 0;
  rows.forEach((row, index) => {
    const id = 'HIST-202606-' + String(index + 2).padStart(3, '0');
    if (existingIds.has(id)) { skipped++; return; }
    const parts = row[0].split('/');
    const date = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]), 9, index, 0);
    const lookupName = aliases[row[1]] || row[1];
    const product = products.find(p => String(p.ProductName).toLowerCase() === lookupName.toLowerCase());
    const itemId = product ? product.ProductID : 'HISTORICAL-ITEM';
    const total = Number(row[2]) * Number(row[3]);
    const notes = row[6] || '';
    const paymentMethod = row[5] === 'QRIS' ? 'qris_mrbob' : 'cash';
    txSh.appendRow([id, date, 'umum', paymentMethod, total, notes, false]);
    itemSh.appendRow([id, 'product', itemId, row[1], Number(row[2]), Number(row[3]), total, '']);
    imported++;
  });
  return { success: true, imported: imported, skipped: skipped, stockChanged: false };
}

function cleanupHistoricalPicNotes() {
  const sh = getSheet(SHEET_TRANSACTIONS);
  const values = sh.getDataRange().getValues();
  if (values.length < 2) return { success: true, updated: 0 };
  const idCol = values[0].indexOf('TransactionID');
  const notesCol = values[0].indexOf('Notes');
  let updated = 0;
  for (let i = 1; i < values.length; i++) {
    if (!String(values[i][idCol]).startsWith('HIST-')) continue;
    const current = String(values[i][notesCol] || '');
    if (!current.startsWith('PIC:')) continue;
    const separator = current.indexOf('|');
    const cleaned = separator >= 0 ? current.substring(separator + 1).trim() : '';
    sh.getRange(i + 1, notesCol + 1).setValue(cleaned);
    updated++;
  }
  return { success: true, updated: updated };
}

function migrateLegacyQrisToMrBob() {
  const sh = getSheet(SHEET_TRANSACTIONS);
  const values = sh.getDataRange().getValues();
  if (values.length < 2) return { success: true, updated: 0 };
  const paymentCol = values[0].indexOf('PaymentMethod');
  let updated = 0;
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][paymentCol]).toLowerCase() === 'qris') {
      sh.getRange(i + 1, paymentCol + 1).setValue('qris_mrbob');
      updated++;
    }
  }
  return { success: true, updated: updated };
}

// ===================================================================
// MENU CUSTOM DI GOOGLE SHEET (opsional, untuk generate report manual)
// ===================================================================
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('POS Tools')
    .addItem('Setup Awal (jalankan sekali)', 'setupSheets')
    .addItem('Import Transaksi 20–21 Juni 2026', 'importHistoricalSalesJune2026')
    .addItem('Hapus PIC dari Transaksi Lama', 'cleanupHistoricalPicNotes')
    .addItem('Pisahkan QRIS Lama ke Mr.BOB', 'migrateLegacyQrisToMrBob')
    .addItem('Generate Sheet Report Sekarang', 'generateReportSheet')
    .addToUi();
}

function generateReportSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const reportName = 'Report - ' + new Date().toLocaleDateString('id-ID');
  let reportSh = ss.getSheetByName(reportName);
  if (reportSh) ss.deleteSheet(reportSh);
  reportSh = ss.insertSheet(reportName);

  const summary = getSalesSummary(null, null);

  reportSh.appendRow(['LAPORAN PENJUALAN POS MERCHANDISE']);
  reportSh.appendRow(['Digenerate pada', new Date()]);
  reportSh.appendRow([]);
  reportSh.appendRow(['RINGKASAN PEMBAYARAN']);
  reportSh.appendRow(['Total Cash', summary.totalCash]);
  reportSh.appendRow(['QRIS Mr.BOB', summary.totalQrisMrBob]);
  reportSh.appendRow(['QRIS Merchandise', summary.totalQrisMerchandise]);
  reportSh.appendRow(['Grand Total', summary.grandTotal]);
  reportSh.appendRow(['Jumlah Transaksi', summary.transactionCount]);
  reportSh.appendRow([]);
  reportSh.appendRow(['BARANG TERLARIS', summary.bestSeller ? summary.bestSeller.name : '-']);
  reportSh.appendRow([]);
  reportSh.appendRow(['RINCIAN PENJUALAN PER ITEM']);
  reportSh.appendRow(['Nama Item', 'Tipe', 'Qty Terjual', 'Total Nominal']);
  summary.itemSales.forEach(it => {
    reportSh.appendRow([it.name, it.type, it.qty, it.total]);
  });
  reportSh.appendRow([]);
  reportSh.appendRow(['SISA STOK']);
  reportSh.appendRow(['Nama Produk', 'Sisa Stok']);
  summary.stockRemaining.forEach(s => {
    reportSh.appendRow([s.productName, s.stock]);
  });

  reportSh.getRange('A1').setFontWeight('bold').setFontSize(14);
  reportSh.autoResizeColumns(1, 4);

  SpreadsheetApp.getUi().alert('Report sheet "' + reportName + '" berhasil dibuat!');
}

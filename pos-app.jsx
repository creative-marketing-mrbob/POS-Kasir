import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ShoppingCart, Package, Layers, BarChart3, Plus, Minus, X, Edit2, Trash2, Check, AlertCircle, Loader2, RefreshCw, Link2, Search } from 'lucide-react';

// ===================================================================
// UTILITIES
// ===================================================================
const formatRupiah = (num) => {
  const n = Number(num) || 0;
  return 'Rp' + n.toLocaleString('id-ID');
};

const STORAGE_KEY_URL = 'pos_webapp_url';

// ===================================================================
// API LAYER
// ===================================================================
function useApi(webAppUrl) {
  const callGet = useCallback(async (action, params = {}) => {
    const query = new URLSearchParams({ action, ...params }).toString();
    const res = await fetch(`${webAppUrl}?${query}`);
    if (!res.ok) throw new Error('Gagal menghubungi server');
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return data;
  }, [webAppUrl]);

  const callPost = useCallback(async (action, data = {}) => {
    const res = await fetch(webAppUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, data }),
    });
    if (!res.ok) throw new Error('Gagal menghubungi server');
    const result = await res.json();
    if (result.error) throw new Error(result.error);
    return result;
  }, [webAppUrl]);

  return useMemo(() => ({ callGet, callPost }), [callGet, callPost]);
}

// ===================================================================
// MAIN APP
// ===================================================================
export default function App() {
  const [webAppUrl, setWebAppUrl] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [connectError, setConnectError] = useState('');
  const [connecting, setConnecting] = useState(false);

  const [activeTab, setActiveTab] = useState('kasir');
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [bundles, setBundles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [globalError, setGlobalError] = useState('');
  const [toast, setToast] = useState(null);

  const api = useApi(webAppUrl);

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2800);
  }, []);

  const loadAllData = useCallback(async () => {
    setLoading(true);
    setGlobalError('');
    try {
      const data = await api.callGet('getAllData');
      setProducts(data.products || []);
      setCategories(data.categories || []);
      setBundles(data.bundles || []);
    } catch (err) {
      setGlobalError('Gagal memuat data: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    if (webAppUrl) loadAllData();
  }, [webAppUrl, loadAllData]);

  const handleConnect = async () => {
    if (!urlInput.trim()) {
      setConnectError('URL tidak boleh kosong');
      return;
    }
    setConnecting(true);
    setConnectError('');
    try {
      const testUrl = urlInput.trim();
      const res = await fetch(`${testUrl}?action=getAllData`);
      if (!res.ok) throw new Error('URL tidak bisa diakses');
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setWebAppUrl(testUrl);
    } catch (err) {
      setConnectError('Gagal terhubung. Pastikan URL benar dan sudah di-deploy sebagai Web App. (' + err.message + ')');
    } finally {
      setConnecting(false);
    }
  };

  // ============ Cart state (shared across kasir flow) ============
  const [cart, setCart] = useState([]); // [{type, id, name, qty, unitPrice, maxStock}]

  if (!webAppUrl) {
    return (
      <ConnectScreen
        urlInput={urlInput}
        setUrlInput={setUrlInput}
        onConnect={handleConnect}
        connecting={connecting}
        error={connectError}
      />
    );
  }

  return (
    <div style={styles.app}>
      <style>{globalCss}</style>
      <Header activeTab={activeTab} setActiveTab={setActiveTab} onRefresh={loadAllData} loading={loading} />

      {toast && <Toast message={toast.message} type={toast.type} />}

      <main style={styles.main}>
        {globalError && (
          <div style={styles.errorBanner}>
            <AlertCircle size={16} />
            <span>{globalError}</span>
          </div>
        )}

        {loading && products.length === 0 ? (
          <div style={styles.loadingState}>
            <Loader2 size={28} className="spin" />
            <p>Memuat data...</p>
          </div>
        ) : (
          <>
            {activeTab === 'kasir' && (
              <KasirTab
                products={products}
                bundles={bundles}
                categories={categories}
                cart={cart}
                setCart={setCart}
                api={api}
                onCheckoutSuccess={() => {
                  showToast('Transaksi berhasil disimpan!');
                  loadAllData();
                }}
                showToast={showToast}
              />
            )}
            {activeTab === 'stok' && (
              <StokTab
                products={products}
                categories={categories}
                api={api}
                onChange={loadAllData}
                showToast={showToast}
              />
            )}
            {activeTab === 'bundling' && (
              <BundlingTab
                bundles={bundles}
                products={products}
                api={api}
                onChange={loadAllData}
                showToast={showToast}
              />
            )}
            {activeTab === 'laporan' && (
              <LaporanTab api={api} webAppUrl={webAppUrl} />
            )}
          </>
        )}
      </main>
    </div>
  );
}

// ===================================================================
// CONNECT SCREEN
// ===================================================================
function ConnectScreen({ urlInput, setUrlInput, onConnect, connecting, error }) {
  return (
    <div style={styles.connectScreen}>
      <style>{globalCss}</style>
      <div style={styles.connectCard}>
        <div style={styles.connectIcon}>
          <Link2 size={28} color="#fff" />
        </div>
        <h1 style={styles.connectTitle}>POS Merchandise</h1>
        <p style={styles.connectSubtitle}>
          Hubungkan ke Google Sheets kamu dengan memasukkan URL Web App dari Apps Script.
        </p>
        <input
          type="text"
          placeholder="https://script.google.com/macros/s/..../exec"
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onConnect()}
          style={styles.connectInput}
        />
        {error && (
          <div style={styles.connectError}>
            <AlertCircle size={14} />
            <span>{error}</span>
          </div>
        )}
        <button onClick={onConnect} disabled={connecting} style={styles.connectButton}>
          {connecting ? <Loader2 size={16} className="spin" /> : <Check size={16} />}
          {connecting ? 'Menghubungkan...' : 'Hubungkan'}
        </button>
        <p style={styles.connectHint}>
          Belum punya URL Web App? Ikuti panduan setup Google Apps Script yang sudah disediakan untuk membuat backend-nya terlebih dahulu.
        </p>
      </div>
    </div>
  );
}

// ===================================================================
// HEADER / NAV
// ===================================================================
function Header({ activeTab, setActiveTab, onRefresh, loading }) {
  const tabs = [
    { id: 'kasir', label: 'Kasir', icon: ShoppingCart },
    { id: 'stok', label: 'Manajemen Stok', icon: Package },
    { id: 'bundling', label: 'Bundling', icon: Layers },
    { id: 'laporan', label: 'Laporan', icon: BarChart3 },
  ];

  return (
    <header style={styles.header}>
      <div style={styles.headerTop}>
        <div style={styles.brand}>
          <div style={styles.brandIcon}>POS</div>
          <span style={styles.brandText}>Merchandise Kasir</span>
        </div>
        <button onClick={onRefresh} style={styles.refreshBtn} title="Muat ulang data">
          <RefreshCw size={16} className={loading ? 'spin' : ''} />
        </button>
      </div>
      <nav style={styles.nav}>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{ ...styles.navBtn, ...(active ? styles.navBtnActive : {}) }}
            >
              <Icon size={16} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </header>
  );
}

// ===================================================================
// TOAST
// ===================================================================
function Toast({ message, type }) {
  return (
    <div style={{ ...styles.toast, ...(type === 'error' ? styles.toastError : {}) }}>
      {type === 'error' ? <AlertCircle size={16} /> : <Check size={16} />}
      <span>{message}</span>
    </div>
  );
}

// ===================================================================
// KASIR TAB
// ===================================================================
function KasirTab({ products, bundles, categories, cart, setCart, api, onCheckoutSuccess, showToast }) {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [viewType, setViewType] = useState('produk'); // produk | bundle
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  const catalog = viewType === 'produk' ? products : bundles;

  const filtered = useMemo(() => {
    return catalog.filter((item) => {
      const name = viewType === 'produk' ? item.ProductName : item.bundleName;
      const matchSearch = name?.toLowerCase().includes(search.toLowerCase());
      const matchCategory =
        viewType === 'bundle' || categoryFilter === 'all' || item.CategoryID === categoryFilter;
      return matchSearch && matchCategory;
    }).sort((a, b) => {
      const nameA = viewType === 'produk' ? a.ProductName : a.bundleName;
      const nameB = viewType === 'produk' ? b.ProductName : b.bundleName;
      return (nameA || '').localeCompare(nameB || '', 'id-ID', { sensitivity: 'base' });
    });
  }, [catalog, search, categoryFilter, viewType]);

  const addToCart = (item, type) => {
    const id = type === 'product' ? item.ProductID : item.bundleId;
    const name = type === 'product' ? item.ProductName : item.bundleName;
    const stock = type === 'product' ? Number(item.Stock) : null;

    setCart((prev) => {
      const existing = prev.find((c) => c.id === id && c.type === type);
      if (existing) {
        if (stock !== null && existing.qty >= stock) {
          showToast('Stok tidak cukup', 'error');
          return prev;
        }
        return prev.map((c) => (c.id === id && c.type === type ? { ...c, qty: c.qty + 1 } : c));
      }
      if (stock !== null && stock <= 0) {
        showToast('Stok habis', 'error');
        return prev;
      }
      return [
        ...prev,
        {
          type,
          id,
          name,
          qty: 1,
          priceUmum: Number(item.PriceUmum ?? item.priceUmum),
          priceKaryawan: Number(item.PriceKaryawan ?? item.priceKaryawan),
          maxStock: stock,
        },
      ];
    });
  };

  return (
    <div>
      <div style={styles.kasirLayout}>
        {/* Katalog */}
        <div style={styles.catalogPane}>
          <div style={styles.toolbar}>
            <div style={styles.searchBox}>
              <Search size={16} color="#94a3b8" />
              <input
                placeholder="Cari produk..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={styles.searchInput}
              />
            </div>
            <div style={styles.viewToggle}>
              <button
                onClick={() => setViewType('produk')}
                style={{ ...styles.viewToggleBtn, ...(viewType === 'produk' ? styles.viewToggleBtnActive : {}) }}
              >
                Produk
              </button>
              <button
                onClick={() => setViewType('bundle')}
                style={{ ...styles.viewToggleBtn, ...(viewType === 'bundle' ? styles.viewToggleBtnActive : {}) }}
              >
                Bundling
              </button>
            </div>
          </div>

          {viewType === 'produk' && (
            <div style={styles.categoryChips}>
              <button
                onClick={() => setCategoryFilter('all')}
                style={{ ...styles.chip, ...(categoryFilter === 'all' ? styles.chipActive : {}) }}
              >
                Semua
              </button>
              {categories.map((c) => (
                <button
                  key={c.CategoryID}
                  onClick={() => setCategoryFilter(c.CategoryID)}
                  style={{ ...styles.chip, ...(categoryFilter === c.CategoryID ? styles.chipActive : {}) }}
                >
                  {c.CategoryName}
                </button>
              ))}
            </div>
          )}

          <div style={styles.productGrid}>
            {filtered.length === 0 && (
              <div style={styles.emptyState}>Tidak ada {viewType === 'produk' ? 'produk' : 'paket bundling'}.</div>
            )}
            {filtered.map((item) => {
              const isProduct = viewType === 'produk';
              const id = isProduct ? item.ProductID : item.bundleId;
              const name = isProduct ? item.ProductName : item.bundleName;
              const priceUmum = isProduct ? item.PriceUmum : item.priceUmum;
              const stock = isProduct ? Number(item.Stock) : null;
              const outOfStock = isProduct && stock <= 0;

              return (
                <button
                  key={id}
                  onClick={() => addToCart(item, isProduct ? 'product' : 'bundle')}
                  disabled={outOfStock}
                  style={{ ...styles.productCard, ...(outOfStock ? styles.productCardDisabled : {}) }}
                >
                  {!isProduct && <span style={styles.bundleBadge}>BUNDLE</span>}
                  <div style={styles.productCardName}>{name}</div>
                  <div style={styles.productCardPrice}>{formatRupiah(priceUmum)}</div>
                  {isProduct && (
                    <div style={{ ...styles.productCardStock, ...(outOfStock ? { color: '#dc2626' } : {}) }}>
                      {outOfStock ? 'Stok habis' : `Stok: ${stock}`}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Keranjang */}
        <CartPane
          cart={cart}
          setCart={setCart}
          onCheckout={() => setCheckoutOpen(true)}
        />
      </div>

      {checkoutOpen && (
        <CheckoutModal
          cart={cart}
          onClose={() => setCheckoutOpen(false)}
          api={api}
          onSuccess={() => {
            setCart([]);
            setCheckoutOpen(false);
            onCheckoutSuccess();
          }}
          showToast={showToast}
        />
      )}
    </div>
  );
}

// ===================================================================
// CART PANE
// ===================================================================
function CartPane({ cart, setCart, onCheckout }) {
  const [customerType, setCustomerType] = useState('umum');

  const updateQty = (id, type, delta) => {
    setCart((prev) =>
      prev
        .map((c) => {
          if (c.id === id && c.type === type) {
            const newQty = c.qty + delta;
            if (c.maxStock !== null && newQty > c.maxStock) return c;
            return { ...c, qty: Math.max(0, newQty) };
          }
          return c;
        })
        .filter((c) => c.qty > 0)
    );
  };

  const removeItem = (id, type) => {
    setCart((prev) => prev.filter((c) => !(c.id === id && c.type === type)));
  };

  const total = cart.reduce((sum, c) => {
    const price = customerType === 'karyawan' ? c.priceKaryawan : c.priceUmum;
    return sum + price * c.qty;
  }, 0);

  return (
    <div style={styles.cartPane}>
      <div style={styles.cartHeader}>
        <span style={styles.cartTitle}>Keranjang</span>
        <span style={styles.cartCount}>{cart.length} item</span>
      </div>

      <div style={styles.customerToggle}>
        <button
          onClick={() => setCustomerType('umum')}
          style={{ ...styles.customerBtn, ...(customerType === 'umum' ? styles.customerBtnActive : {}) }}
        >
          Harga Umum
        </button>
        <button
          onClick={() => setCustomerType('karyawan')}
          style={{ ...styles.customerBtn, ...(customerType === 'karyawan' ? styles.customerBtnActiveKaryawan : {}) }}
        >
          Harga Karyawan
        </button>
      </div>

      <div style={styles.cartItems}>
        {cart.length === 0 && <div style={styles.emptyState}>Keranjang masih kosong.</div>}
        {cart.map((c) => {
          const price = customerType === 'karyawan' ? c.priceKaryawan : c.priceUmum;
          return (
            <div key={`${c.type}-${c.id}`} style={styles.cartItem}>
              <div style={styles.cartItemTop}>
                <span style={styles.cartItemName}>
                  {c.type === 'bundle' && <Layers size={12} style={{ marginRight: 4 }} />}
                  {c.name}
                </span>
                <button onClick={() => removeItem(c.id, c.type)} style={styles.cartItemRemove}>
                  <X size={14} />
                </button>
              </div>
              <div style={styles.cartItemBottom}>
                <div style={styles.qtyControl}>
                  <button onClick={() => updateQty(c.id, c.type, -1)} style={styles.qtyBtn}>
                    <Minus size={12} />
                  </button>
                  <span style={styles.qtyValue}>{c.qty}</span>
                  <button onClick={() => updateQty(c.id, c.type, 1)} style={styles.qtyBtn}>
                    <Plus size={12} />
                  </button>
                </div>
                <span style={styles.cartItemPrice}>{formatRupiah(price * c.qty)}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div style={styles.cartFooter}>
        <div style={styles.cartTotalRow}>
          <span>Total</span>
          <span style={styles.cartTotalValue}>{formatRupiah(total)}</span>
        </div>
        <button
          onClick={onCheckout}
          disabled={cart.length === 0}
          style={{ ...styles.checkoutBtn, ...(cart.length === 0 ? styles.checkoutBtnDisabled : {}) }}
        >
          Lanjut ke Pembayaran
        </button>
      </div>
    </div>
  );
}

// ===================================================================
// CHECKOUT MODAL — edit produk dulu, lalu pilih payment
// ===================================================================
function CheckoutModal({ cart: initialCart, onClose, api, onSuccess, showToast }) {
  const [cart, setCart] = useState(initialCart);
  const [customerType, setCustomerType] = useState('umum');
  const [step, setStep] = useState('review'); // review | payment
  const [paymentMethod, setPaymentMethod] = useState(null);
  const [processing, setProcessing] = useState(false);

  const updateQty = (id, type, delta) => {
    setCart((prev) =>
      prev
        .map((c) => {
          if (c.id === id && c.type === type) {
            const newQty = c.qty + delta;
            if (c.maxStock !== null && newQty > c.maxStock) return c;
            return { ...c, qty: Math.max(0, newQty) };
          }
          return c;
        })
        .filter((c) => c.qty > 0)
    );
  };

  const removeItem = (id, type) => {
    setCart((prev) => prev.filter((c) => !(c.id === id && c.type === type)));
  };

  const total = cart.reduce((sum, c) => {
    const price = customerType === 'karyawan' ? c.priceKaryawan : c.priceUmum;
    return sum + price * c.qty;
  }, 0);

  const handlePay = async () => {
    if (!paymentMethod) return;
    setProcessing(true);
    try {
      const items = cart.map((c) => ({
        type: c.type,
        id: c.id,
        name: c.name,
        qty: c.qty,
        unitPrice: customerType === 'karyawan' ? c.priceKaryawan : c.priceUmum,
      }));
      const result = await api.callPost('checkout', {
        customerType,
        paymentMethod,
        items,
        notes: '',
      });
      if (result.success) {
        onSuccess();
      } else {
        showToast(result.error || 'Checkout gagal', 'error');
      }
    } catch (err) {
      showToast('Checkout gagal: ' + err.message, 'error');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div style={styles.modalOverlay}>
      <div style={styles.modalCard}>
        <div style={styles.modalHeader}>
          <span style={styles.modalTitle}>
            {step === 'review' ? 'Periksa Pesanan' : 'Pembayaran'}
          </span>
          <button onClick={onClose} style={styles.modalClose}>
            <X size={18} />
          </button>
        </div>

        {step === 'review' && (
          <>
            <div style={styles.customerToggle}>
              <button
                onClick={() => setCustomerType('umum')}
                style={{ ...styles.customerBtn, ...(customerType === 'umum' ? styles.customerBtnActive : {}) }}
              >
                Harga Umum
              </button>
              <button
                onClick={() => setCustomerType('karyawan')}
                style={{ ...styles.customerBtn, ...(customerType === 'karyawan' ? styles.customerBtnActiveKaryawan : {}) }}
              >
                Harga Karyawan
              </button>
            </div>

            <div style={styles.modalBody}>
              {cart.length === 0 && <div style={styles.emptyState}>Keranjang kosong.</div>}
              {cart.map((c) => {
                const price = customerType === 'karyawan' ? c.priceKaryawan : c.priceUmum;
                return (
                  <div key={`${c.type}-${c.id}`} style={styles.reviewItem}>
                    <div style={styles.reviewItemInfo}>
                      <span style={styles.cartItemName}>
                        {c.type === 'bundle' && <Layers size={12} style={{ marginRight: 4 }} />}
                        {c.name}
                      </span>
                      <span style={styles.reviewItemUnitPrice}>{formatRupiah(price)} / item</span>
                    </div>
                    <div style={styles.qtyControl}>
                      <button onClick={() => updateQty(c.id, c.type, -1)} style={styles.qtyBtn}>
                        <Minus size={12} />
                      </button>
                      <span style={styles.qtyValue}>{c.qty}</span>
                      <button onClick={() => updateQty(c.id, c.type, 1)} style={styles.qtyBtn}>
                        <Plus size={12} />
                      </button>
                    </div>
                    <span style={styles.reviewItemSubtotal}>{formatRupiah(price * c.qty)}</span>
                    <button onClick={() => removeItem(c.id, c.type)} style={styles.cartItemRemove}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })}
            </div>

            <div style={styles.modalFooter}>
              <div style={styles.cartTotalRow}>
                <span>Total</span>
                <span style={styles.cartTotalValue}>{formatRupiah(total)}</span>
              </div>
              <button
                onClick={() => setStep('payment')}
                disabled={cart.length === 0}
                style={{ ...styles.checkoutBtn, ...(cart.length === 0 ? styles.checkoutBtnDisabled : {}) }}
              >
                Pilih Metode Pembayaran
              </button>
            </div>
          </>
        )}

        {step === 'payment' && (
          <>
            <div style={styles.modalBody}>
              <div style={styles.paymentTotalDisplay}>
                <span style={styles.paymentTotalLabel}>Total Pembayaran</span>
                <span style={styles.paymentTotalValue}>{formatRupiah(total)}</span>
              </div>

              <div style={styles.paymentOptions}>
                <button
                  onClick={() => setPaymentMethod('cash')}
                  style={{ ...styles.paymentOption, ...(paymentMethod === 'cash' ? styles.paymentOptionActive : {}) }}
                >
                  <span style={styles.paymentOptionLabel}>💵 Cash</span>
                </button>
                <button
                  onClick={() => setPaymentMethod('qris')}
                  style={{ ...styles.paymentOption, ...(paymentMethod === 'qris' ? styles.paymentOptionActive : {}) }}
                >
                  <span style={styles.paymentOptionLabel}>📱 QRIS</span>
                </button>
              </div>
            </div>

            <div style={styles.modalFooter}>
              <button onClick={() => setStep('review')} style={styles.backBtn}>
                Kembali
              </button>
              <button
                onClick={handlePay}
                disabled={!paymentMethod || processing}
                style={{
                  ...styles.checkoutBtn,
                  ...(!paymentMethod || processing ? styles.checkoutBtnDisabled : {}),
                }}
              >
                {processing ? <Loader2 size={16} className="spin" /> : 'Selesaikan Transaksi'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ===================================================================
// STOK TAB — manajemen produk & kategori
// ===================================================================
function StokTab({ products, categories, api, onChange, showToast }) {
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [search, setSearch] = useState('');

  const filtered = products
    .filter((p) => p.ProductName?.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => (a.ProductName || '').localeCompare(b.ProductName || '', 'id-ID', { sensitivity: 'base' }));

  const categoryName = (id) => categories.find((c) => c.CategoryID === id)?.CategoryName || '-';

  return (
    <div>
      <div style={styles.sectionHeader}>
        <h2 style={styles.sectionTitle}>Manajemen Stok</h2>
        <div style={styles.sectionActions}>
          <button onClick={() => setShowAddCategory(true)} style={styles.secondaryBtn}>
            <Plus size={14} /> Kategori
          </button>
          <button onClick={() => setShowAddProduct(true)} style={styles.primaryBtn}>
            <Plus size={14} /> Produk Baru
          </button>
        </div>
      </div>

      <div style={styles.searchBox}>
        <Search size={16} color="#94a3b8" />
        <input
          placeholder="Cari produk..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={styles.searchInput}
        />
      </div>

      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Nama Produk</th>
              <th style={styles.th}>Kategori</th>
              <th style={styles.th}>Harga Umum</th>
              <th style={styles.th}>Harga Karyawan</th>
              <th style={styles.th}>Stok</th>
              <th style={styles.th}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} style={styles.emptyTableCell}>
                  Belum ada produk. Klik "Produk Baru" untuk menambahkan.
                </td>
              </tr>
            )}
            {filtered.map((p) => (
              <tr key={p.ProductID} style={styles.tr}>
                <td style={styles.td}>{p.ProductName}</td>
                <td style={styles.td}>{categoryName(p.CategoryID)}</td>
                <td style={styles.td}>{formatRupiah(p.PriceUmum)}</td>
                <td style={styles.td}>{formatRupiah(p.PriceKaryawan)}</td>
                <td style={styles.td}>
                  <span style={{ ...styles.stockBadge, ...(Number(p.Stock) <= 5 ? styles.stockBadgeLow : {}) }}>
                    {p.Stock}
                  </span>
                </td>
                <td style={styles.td}>
                  <div style={styles.tableActions}>
                    <button onClick={() => setEditingProduct(p)} style={styles.iconBtn} title="Edit">
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={async () => {
                        if (!confirm(`Hapus produk "${p.ProductName}"?`)) return;
                        try {
                          await api.callPost('deleteProduct', { productId: p.ProductID });
                          showToast('Produk dihapus');
                          onChange();
                        } catch (err) {
                          showToast('Gagal menghapus produk: ' + err.message, 'error');
                        }
                      }}
                      style={styles.iconBtnDanger}
                      title="Hapus"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showAddProduct && (
        <ProductFormModal
          categories={categories}
          onClose={() => setShowAddProduct(false)}
          onSubmit={async (data) => {
            try {
              await api.callPost('addProduct', data);
              showToast('Produk berhasil ditambahkan');
              setShowAddProduct(false);
              onChange();
            } catch (err) {
              showToast('Gagal menambahkan produk: ' + err.message, 'error');
            }
          }}
        />
      )}

      {editingProduct && (
        <ProductFormModal
          categories={categories}
          initialData={editingProduct}
          onClose={() => setEditingProduct(null)}
          onSubmit={async (data) => {
            try {
              await api.callPost('updateProduct', { ...data, productId: editingProduct.ProductID });
              showToast('Produk berhasil diperbarui');
              setEditingProduct(null);
              onChange();
            } catch (err) {
              showToast('Gagal memperbarui produk: ' + err.message, 'error');
            }
          }}
        />
      )}

      {showAddCategory && (
        <CategoryFormModal
          onClose={() => setShowAddCategory(false)}
          onSubmit={async (categoryName) => {
            try {
              await api.callPost('addCategory', { categoryName });
              showToast('Kategori berhasil ditambahkan');
              setShowAddCategory(false);
              onChange();
            } catch (err) {
              showToast('Gagal menambahkan kategori: ' + err.message, 'error');
            }
          }}
        />
      )}
    </div>
  );
}

function ProductFormModal({ categories, initialData, onClose, onSubmit }) {
  const [form, setForm] = useState({
    productName: initialData?.ProductName || '',
    categoryId: initialData?.CategoryID || categories[0]?.CategoryID || '',
    priceUmum: initialData?.PriceUmum ?? '',
    priceKaryawan: initialData?.PriceKaryawan ?? '',
    stock: initialData?.Stock ?? '',
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!form.productName || form.priceUmum === '' || form.stock === '') return;
    setSubmitting(true);
    try {
      await onSubmit(form);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={styles.modalOverlay}>
      <div style={styles.modalCardSmall}>
        <div style={styles.modalHeader}>
          <span style={styles.modalTitle}>{initialData ? 'Edit Produk' : 'Produk Baru'}</span>
          <button onClick={onClose} style={styles.modalClose}>
            <X size={18} />
          </button>
        </div>
        <div style={styles.modalBody}>
          <FormField label="Nama Produk">
            <input
              value={form.productName}
              onChange={(e) => setForm({ ...form, productName: e.target.value })}
              style={styles.formInput}
              placeholder="Contoh: Kaos Polo Instansi"
            />
          </FormField>
          <FormField label="Kategori">
            <select
              value={form.categoryId}
              onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
              style={styles.formInput}
            >
              {categories.map((c) => (
                <option key={c.CategoryID} value={c.CategoryID}>
                  {c.CategoryName}
                </option>
              ))}
            </select>
          </FormField>
          <div style={styles.formRow}>
            <FormField label="Harga Umum">
              <input
                type="number"
                value={form.priceUmum}
                onChange={(e) => setForm({ ...form, priceUmum: e.target.value })}
                style={styles.formInput}
                placeholder="0"
              />
            </FormField>
            <FormField label="Harga Karyawan">
              <input
                type="number"
                value={form.priceKaryawan}
                onChange={(e) => setForm({ ...form, priceKaryawan: e.target.value })}
                style={styles.formInput}
                placeholder="0"
              />
            </FormField>
          </div>
          <FormField label="Jumlah Stok">
            <input
              type="number"
              value={form.stock}
              onChange={(e) => setForm({ ...form, stock: e.target.value })}
              style={styles.formInput}
              placeholder="0"
            />
          </FormField>
        </div>
        <div style={styles.modalFooter}>
          <button onClick={handleSubmit} disabled={submitting} style={styles.checkoutBtn}>
            {submitting ? <Loader2 size={16} className="spin" /> : 'Simpan Produk'}
          </button>
        </div>
      </div>
    </div>
  );
}

function CategoryFormModal({ onClose, onSubmit }) {
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  return (
    <div style={styles.modalOverlay}>
      <div style={styles.modalCardSmall}>
        <div style={styles.modalHeader}>
          <span style={styles.modalTitle}>Kategori Baru</span>
          <button onClick={onClose} style={styles.modalClose}>
            <X size={18} />
          </button>
        </div>
        <div style={styles.modalBody}>
          <FormField label="Nama Kategori">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={styles.formInput}
              placeholder="Contoh: Topi"
              autoFocus
            />
          </FormField>
        </div>
        <div style={styles.modalFooter}>
          <button
            onClick={async () => {
              if (!name.trim()) return;
              setSubmitting(true);
              try {
                await onSubmit(name.trim());
              } finally {
                setSubmitting(false);
              }
            }}
            disabled={submitting}
            style={styles.checkoutBtn}
          >
            {submitting ? <Loader2 size={16} className="spin" /> : 'Simpan Kategori'}
          </button>
        </div>
      </div>
    </div>
  );
}

function FormField({ label, children }) {
  return (
    <div style={styles.formField}>
      <label style={styles.formLabel}>{label}</label>
      {children}
    </div>
  );
}

// ===================================================================
// BUNDLING TAB
// ===================================================================
function BundlingTab({ bundles, products, api, onChange, showToast }) {
  const [showAdd, setShowAdd] = useState(false);
  const [editingBundle, setEditingBundle] = useState(null);

  const productName = (id) => products.find((p) => p.ProductID === id)?.ProductName || '(produk dihapus)';

  return (
    <div>
      <div style={styles.sectionHeader}>
        <h2 style={styles.sectionTitle}>Bundling Produk</h2>
        <button onClick={() => setShowAdd(true)} style={styles.primaryBtn}>
          <Plus size={14} /> Bundle Baru
        </button>
      </div>

      <p style={styles.sectionDesc}>
        Bundle adalah paket gabungan dari beberapa produk dengan satu harga. Saat bundle terjual, stok tiap produk
        penyusunnya otomatis berkurang sesuai komposisi.
      </p>

      <div style={styles.bundleGrid}>
        {bundles.length === 0 && <div style={styles.emptyState}>Belum ada paket bundling.</div>}
        {bundles.map((b) => (
          <div key={b.bundleId} style={styles.bundleCard}>
            <div style={styles.bundleCardHeader}>
              <span style={styles.bundleCardName}>{b.bundleName}</span>
              <div style={styles.tableActions}>
                <button onClick={() => setEditingBundle(b)} style={styles.iconBtn}>
                  <Edit2 size={14} />
                </button>
                <button
                  onClick={async () => {
                    if (!confirm(`Hapus bundle "${b.bundleName}"?`)) return;
                    try {
                      await api.callPost('deleteBundle', { bundleId: b.bundleId });
                      showToast('Bundle dihapus');
                      onChange();
                    } catch (err) {
                      showToast('Gagal menghapus bundle: ' + err.message, 'error');
                    }
                  }}
                  style={styles.iconBtnDanger}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
            <div style={styles.bundleCardPrices}>
              <span>Umum: {formatRupiah(b.priceUmum)}</span>
              <span>Karyawan: {formatRupiah(b.priceKaryawan)}</span>
            </div>
            <div style={styles.bundleCardComponents}>
              {b.components.map((comp, i) => (
                <div key={i} style={styles.bundleComponentRow}>
                  <span>{productName(comp.productId)}</span>
                  <span style={styles.bundleComponentQty}>×{comp.qty}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {showAdd && (
        <BundleFormModal
          products={products}
          onClose={() => setShowAdd(false)}
          onSubmit={async (data) => {
            try {
              await api.callPost('addBundle', data);
              showToast('Bundle berhasil dibuat');
              setShowAdd(false);
              onChange();
            } catch (err) {
              showToast('Gagal membuat bundle: ' + err.message, 'error');
            }
          }}
        />
      )}

      {editingBundle && (
        <BundleFormModal
          products={products}
          initialData={editingBundle}
          onClose={() => setEditingBundle(null)}
          onSubmit={async (data) => {
            try {
              await api.callPost('updateBundle', { ...data, bundleId: editingBundle.bundleId });
              showToast('Bundle berhasil diperbarui');
              setEditingBundle(null);
              onChange();
            } catch (err) {
              showToast('Gagal memperbarui bundle: ' + err.message, 'error');
            }
          }}
        />
      )}
    </div>
  );
}

function BundleFormModal({ products, initialData, onClose, onSubmit }) {
  const [bundleName, setBundleName] = useState(initialData?.bundleName || '');
  const [priceUmum, setPriceUmum] = useState(initialData?.priceUmum ?? '');
  const [priceKaryawan, setPriceKaryawan] = useState(initialData?.priceKaryawan ?? '');
  const [components, setComponents] = useState(initialData?.components || []);
  const [submitting, setSubmitting] = useState(false);

  const addComponent = () => {
    if (products.length === 0) return;
    setComponents([...components, { productId: products[0].ProductID, qty: 1 }]);
  };

  const updateComponent = (index, field, value) => {
    setComponents(components.map((c, i) => (i === index ? { ...c, [field]: value } : c)));
  };

  const removeComponent = (index) => {
    setComponents(components.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!bundleName || priceUmum === '' || components.length === 0) return;
    setSubmitting(true);
    try {
      await onSubmit({ bundleName, priceUmum, priceKaryawan, components });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={styles.modalOverlay}>
      <div style={styles.modalCardSmall}>
        <div style={styles.modalHeader}>
          <span style={styles.modalTitle}>{initialData ? 'Edit Bundle' : 'Bundle Baru'}</span>
          <button onClick={onClose} style={styles.modalClose}>
            <X size={18} />
          </button>
        </div>
        <div style={styles.modalBody}>
          <FormField label="Nama Bundle">
            <input
              value={bundleName}
              onChange={(e) => setBundleName(e.target.value)}
              style={styles.formInput}
              placeholder="Contoh: Paket Lengkap Wisuda"
            />
          </FormField>
          <div style={styles.formRow}>
            <FormField label="Harga Umum">
              <input
                type="number"
                value={priceUmum}
                onChange={(e) => setPriceUmum(e.target.value)}
                style={styles.formInput}
                placeholder="0"
              />
            </FormField>
            <FormField label="Harga Karyawan">
              <input
                type="number"
                value={priceKaryawan}
                onChange={(e) => setPriceKaryawan(e.target.value)}
                style={styles.formInput}
                placeholder="0"
              />
            </FormField>
          </div>

          <div style={styles.formField}>
            <label style={styles.formLabel}>Komponen Produk</label>
            {components.map((comp, i) => (
              <div key={i} style={styles.componentRow}>
                <select
                  value={comp.productId}
                  onChange={(e) => updateComponent(i, 'productId', e.target.value)}
                  style={{ ...styles.formInput, flex: 1 }}
                >
                  {products.map((p) => (
                    <option key={p.ProductID} value={p.ProductID}>
                      {p.ProductName}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min="1"
                  value={comp.qty}
                  onChange={(e) => updateComponent(i, 'qty', Number(e.target.value))}
                  style={{ ...styles.formInput, width: 60 }}
                />
                <button onClick={() => removeComponent(i)} style={styles.iconBtnDanger}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            <button onClick={addComponent} style={styles.addComponentBtn}>
              <Plus size={14} /> Tambah Komponen
            </button>
          </div>
        </div>
        <div style={styles.modalFooter}>
          <button onClick={handleSubmit} disabled={submitting} style={styles.checkoutBtn}>
            {submitting ? <Loader2 size={16} className="spin" /> : 'Simpan Bundle'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ===================================================================
// LAPORAN TAB
// ===================================================================
function LaporanTab({ api, webAppUrl }) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadSummary = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.callGet('getSalesSummary');
      setSummary(data);
    } catch (err) {
      setError('Gagal memuat laporan: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  if (loading) {
    return (
      <div style={styles.loadingState}>
        <Loader2 size={28} className="spin" />
        <p>Memuat laporan...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.errorBanner}>
        <AlertCircle size={16} />
        <span>{error}</span>
      </div>
    );
  }

  if (!summary) return null;

  const lowStock = summary.stockRemaining.filter((s) => Number(s.stock) <= 5);

  return (
    <div>
      <div style={styles.sectionHeader}>
        <h2 style={styles.sectionTitle}>Laporan Penjualan</h2>
        <button onClick={loadSummary} style={styles.secondaryBtn}>
          <RefreshCw size={14} /> Muat Ulang
        </button>
      </div>

      <div style={styles.statGrid}>
        <div style={styles.statCard}>
          <span style={styles.statLabel}>Total Cash</span>
          <span style={styles.statValue}>{formatRupiah(summary.totalCash)}</span>
        </div>
        <div style={styles.statCard}>
          <span style={styles.statLabel}>Total QRIS</span>
          <span style={styles.statValue}>{formatRupiah(summary.totalQris)}</span>
        </div>
        <div style={{ ...styles.statCard, ...styles.statCardHighlight }}>
          <span style={styles.statLabel}>Grand Total</span>
          <span style={styles.statValue}>{formatRupiah(summary.grandTotal)}</span>
        </div>
        <div style={styles.statCard}>
          <span style={styles.statLabel}>Jumlah Transaksi</span>
          <span style={styles.statValue}>{summary.transactionCount}</span>
        </div>
      </div>

      {summary.bestSeller && (
        <div style={styles.insightBanner}>
          🏆 Barang paling laris: <strong>{summary.bestSeller.name}</strong> — terjual {summary.bestSeller.qty}{' '}
          unit ({formatRupiah(summary.bestSeller.total)})
        </div>
      )}

      <div style={styles.reportColumns}>
        <div style={styles.reportColumn}>
          <h3 style={styles.reportColumnTitle}>Rincian Penjualan per Item</h3>
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Nama</th>
                  <th style={styles.th}>Qty</th>
                  <th style={styles.th}>Total</th>
                </tr>
              </thead>
              <tbody>
                {summary.itemSales.length === 0 && (
                  <tr>
                    <td colSpan={3} style={styles.emptyTableCell}>
                      Belum ada penjualan.
                    </td>
                  </tr>
                )}
                {summary.itemSales.map((it, i) => (
                  <tr key={i} style={styles.tr}>
                    <td style={styles.td}>
                      {it.type === 'bundle' && <Layers size={12} style={{ marginRight: 4 }} />}
                      {it.name}
                    </td>
                    <td style={styles.td}>{it.qty}</td>
                    <td style={styles.td}>{formatRupiah(it.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div style={styles.reportColumn}>
          <h3 style={styles.reportColumnTitle}>
            Sisa Stok {lowStock.length > 0 && <span style={styles.lowStockNote}>({lowStock.length} hampir habis)</span>}
          </h3>
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Nama Produk</th>
                  <th style={styles.th}>Sisa Stok</th>
                </tr>
              </thead>
              <tbody>
                {summary.stockRemaining.map((s, i) => (
                  <tr key={i} style={styles.tr}>
                    <td style={styles.td}>{s.productName}</td>
                    <td style={styles.td}>
                      <span style={{ ...styles.stockBadge, ...(Number(s.stock) <= 5 ? styles.stockBadgeLow : {}) }}>
                        {s.stock}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div style={styles.sheetLinkBanner}>
        <BarChart3 size={16} />
        <span>
          Laporan ini selalu sinkron dengan Google Sheets kamu. Untuk laporan siap-print/export, buka Sheet kamu →
          menu <strong>POS Tools</strong> → <strong>Generate Sheet Report Sekarang</strong>.
        </span>
      </div>
    </div>
  );
}

// ===================================================================
// STYLES
// ===================================================================
const globalCss = `
  * { box-sizing: border-box; }
  body { margin: 0; }
  .spin { animation: spin 1s linear infinite; }
  @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  input:focus, select:focus, button:focus-visible {
    outline: 2px solid #2563eb;
    outline-offset: 1px;
  }
  table { border-collapse: collapse; width: 100%; }
  ::-webkit-scrollbar { width: 8px; height: 8px; }
  ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
`;

const COLORS = {
  bg: '#f8fafc',
  surface: '#ffffff',
  border: '#e2e8f0',
  text: '#0f172a',
  textMuted: '#64748b',
  primary: '#1d4ed8',
  primaryLight: '#eff6ff',
  accent: '#0d9488',
  danger: '#dc2626',
  warning: '#d97706',
};

const styles = {
  app: {
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    background: COLORS.bg,
    minHeight: '100vh',
    color: COLORS.text,
  },
  header: {
    background: COLORS.surface,
    borderBottom: `1px solid ${COLORS.border}`,
    position: 'sticky',
    top: 0,
    zIndex: 10,
  },
  headerTop: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 20px 0',
  },
  brand: { display: 'flex', alignItems: 'center', gap: 10 },
  brandIcon: {
    background: COLORS.primary,
    color: '#fff',
    fontWeight: 700,
    fontSize: 12,
    padding: '6px 9px',
    borderRadius: 6,
    letterSpacing: 0.5,
  },
  brandText: { fontWeight: 600, fontSize: 15, color: COLORS.text },
  refreshBtn: {
    background: 'transparent',
    border: `1px solid ${COLORS.border}`,
    borderRadius: 6,
    padding: 7,
    cursor: 'pointer',
    color: COLORS.textMuted,
    display: 'flex',
  },
  nav: { display: 'flex', gap: 4, padding: '10px 20px 0' },
  navBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '9px 14px',
    border: 'none',
    background: 'transparent',
    borderRadius: 8,
    cursor: 'pointer',
    fontSize: 13.5,
    fontWeight: 500,
    color: COLORS.textMuted,
    borderBottom: '2px solid transparent',
  },
  navBtnActive: {
    color: COLORS.primary,
    background: COLORS.primaryLight,
  },
  main: { padding: '20px', maxWidth: 1280, margin: '0 auto' },
  loadingState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 10,
    padding: '60px 0',
    color: COLORS.textMuted,
  },
  errorBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    background: '#fef2f2',
    color: COLORS.danger,
    padding: '10px 14px',
    borderRadius: 8,
    marginBottom: 16,
    fontSize: 13.5,
  },
  toast: {
    position: 'fixed',
    top: 16,
    right: 16,
    background: '#0f172a',
    color: '#fff',
    padding: '10px 16px',
    borderRadius: 8,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 13.5,
    zIndex: 100,
    boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
  },
  toastError: { background: COLORS.danger },

  // Connect screen
  connectScreen: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#0f172a',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    padding: 20,
  },
  connectCard: {
    background: '#fff',
    borderRadius: 16,
    padding: '36px 32px',
    maxWidth: 420,
    width: '100%',
    textAlign: 'center',
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
  },
  connectIcon: {
    width: 52,
    height: 52,
    borderRadius: 12,
    background: COLORS.primary,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 16px',
  },
  connectTitle: { fontSize: 20, fontWeight: 700, margin: '0 0 8px' },
  connectSubtitle: { fontSize: 13.5, color: COLORS.textMuted, margin: '0 0 20px', lineHeight: 1.5 },
  connectInput: {
    width: '100%',
    padding: '11px 14px',
    borderRadius: 8,
    border: `1px solid ${COLORS.border}`,
    fontSize: 13,
    marginBottom: 10,
  },
  connectError: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 6,
    color: COLORS.danger,
    fontSize: 12.5,
    textAlign: 'left',
    marginBottom: 10,
    lineHeight: 1.4,
  },
  connectButton: {
    width: '100%',
    padding: '11px 0',
    background: COLORS.primary,
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  connectHint: { fontSize: 11.5, color: '#94a3b8', marginTop: 16, lineHeight: 1.5 },

  // Kasir layout
  kasirLayout: { display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20, alignItems: 'start' },
  catalogPane: {},
  toolbar: { display: 'flex', gap: 10, marginBottom: 12 },
  searchBox: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    background: COLORS.surface,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 8,
    padding: '9px 12px',
    flex: 1,
    marginBottom: 12,
  },
  searchInput: { border: 'none', outline: 'none', fontSize: 13.5, flex: 1, background: 'transparent' },
  viewToggle: { display: 'flex', background: '#eef2f7', borderRadius: 8, padding: 3 },
  viewToggleBtn: {
    border: 'none',
    background: 'transparent',
    padding: '8px 14px',
    borderRadius: 6,
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    color: COLORS.textMuted,
  },
  viewToggleBtnActive: { background: '#fff', color: COLORS.text, boxShadow: '0 1px 2px rgba(0,0,0,0.06)' },
  categoryChips: { display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' },
  chip: {
    border: `1px solid ${COLORS.border}`,
    background: COLORS.surface,
    padding: '6px 12px',
    borderRadius: 20,
    fontSize: 12.5,
    cursor: 'pointer',
    color: COLORS.textMuted,
  },
  chipActive: { background: COLORS.primary, color: '#fff', borderColor: COLORS.primary },
  productGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
    gap: 10,
  },
  productCard: {
    textAlign: 'left',
    background: COLORS.surface,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 10,
    padding: '14px 14px',
    cursor: 'pointer',
    position: 'relative',
    transition: 'box-shadow 0.15s',
  },
  productCardDisabled: { opacity: 0.5, cursor: 'not-allowed' },
  bundleBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    fontSize: 9,
    fontWeight: 700,
    color: COLORS.accent,
    background: '#f0fdfa',
    padding: '2px 6px',
    borderRadius: 4,
  },
  productCardName: { fontSize: 13.5, fontWeight: 600, marginBottom: 6, lineHeight: 1.3 },
  productCardPrice: { fontSize: 14, fontWeight: 700, color: COLORS.primary, marginBottom: 4 },
  productCardStock: { fontSize: 11.5, color: COLORS.textMuted },
  emptyState: { padding: '30px 0', textAlign: 'center', color: COLORS.textMuted, fontSize: 13 },

  // Cart pane
  cartPane: {
    background: COLORS.surface,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 12,
    display: 'flex',
    flexDirection: 'column',
    maxHeight: 'calc(100vh - 160px)',
    position: 'sticky',
    top: 132,
  },
  cartHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '14px 16px',
    borderBottom: `1px solid ${COLORS.border}`,
  },
  cartTitle: { fontWeight: 600, fontSize: 14.5 },
  cartCount: { fontSize: 12, color: COLORS.textMuted },
  customerToggle: { display: 'flex', gap: 6, padding: '12px 16px 0' },
  customerBtn: {
    flex: 1,
    padding: '8px 0',
    border: `1px solid ${COLORS.border}`,
    background: COLORS.surface,
    borderRadius: 7,
    fontSize: 12.5,
    fontWeight: 500,
    cursor: 'pointer',
    color: COLORS.textMuted,
  },
  customerBtnActive: { background: COLORS.primaryLight, borderColor: COLORS.primary, color: COLORS.primary },
  customerBtnActiveKaryawan: { background: '#f0fdfa', borderColor: COLORS.accent, color: COLORS.accent },
  cartItems: { padding: '12px 16px', overflowY: 'auto', flex: 1, minHeight: 80 },
  cartItem: { paddingBottom: 12, marginBottom: 12, borderBottom: `1px solid #f1f5f9` },
  cartItemTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  cartItemName: { fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center' },
  cartItemRemove: { border: 'none', background: 'transparent', cursor: 'pointer', color: '#cbd5e1', padding: 2 },
  cartItemBottom: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  qtyControl: { display: 'flex', alignItems: 'center', gap: 8, background: '#f8fafc', borderRadius: 6, padding: '3px 6px' },
  qtyBtn: {
    border: 'none',
    background: '#fff',
    width: 22,
    height: 22,
    borderRadius: 4,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
  },
  qtyValue: { fontSize: 13, fontWeight: 600, minWidth: 18, textAlign: 'center' },
  cartItemPrice: { fontSize: 13, fontWeight: 600 },
  cartFooter: { padding: '14px 16px', borderTop: `1px solid ${COLORS.border}` },
  cartTotalRow: { display: 'flex', justifyContent: 'space-between', marginBottom: 12, fontSize: 14 },
  cartTotalValue: { fontWeight: 700, fontSize: 17 },
  checkoutBtn: {
    width: '100%',
    padding: '12px 0',
    background: COLORS.primary,
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  checkoutBtnDisabled: { background: '#cbd5e1', cursor: 'not-allowed' },

  // Modal
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(15,23,42,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
    padding: 20,
  },
  modalCard: {
    background: '#fff',
    borderRadius: 14,
    width: '100%',
    maxWidth: 520,
    maxHeight: '85vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  modalCardSmall: {
    background: '#fff',
    borderRadius: 14,
    width: '100%',
    maxWidth: 440,
    maxHeight: '85vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
    borderBottom: `1px solid ${COLORS.border}`,
  },
  modalTitle: { fontWeight: 600, fontSize: 15.5 },
  modalClose: { border: 'none', background: 'transparent', cursor: 'pointer', color: COLORS.textMuted },
  modalBody: { padding: '16px 20px', overflowY: 'auto', flex: 1 },
  modalFooter: { padding: '14px 20px', borderTop: `1px solid ${COLORS.border}`, display: 'flex', gap: 10 },

  reviewItem: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid #f1f5f9' },
  reviewItemInfo: { flex: 1, display: 'flex', flexDirection: 'column', gap: 2 },
  reviewItemUnitPrice: { fontSize: 11.5, color: COLORS.textMuted },
  reviewItemSubtotal: { fontSize: 13, fontWeight: 600, minWidth: 78, textAlign: 'right' },

  paymentTotalDisplay: { textAlign: 'center', padding: '10px 0 24px' },
  paymentTotalLabel: { display: 'block', fontSize: 12.5, color: COLORS.textMuted, marginBottom: 4 },
  paymentTotalValue: { fontSize: 28, fontWeight: 700 },
  paymentOptions: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  paymentOption: {
    border: `2px solid ${COLORS.border}`,
    borderRadius: 10,
    padding: '22px 0',
    background: '#fff',
    cursor: 'pointer',
    fontSize: 15,
  },
  paymentOptionActive: { borderColor: COLORS.primary, background: COLORS.primaryLight },
  paymentOptionLabel: { fontWeight: 600 },
  backBtn: {
    padding: '12px 18px',
    background: '#f1f5f9',
    color: COLORS.text,
    border: 'none',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  },

  // Stok tab
  sectionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 },
  sectionTitle: { fontSize: 18, fontWeight: 700, margin: 0 },
  sectionActions: { display: 'flex', gap: 8 },
  sectionDesc: { fontSize: 13, color: COLORS.textMuted, marginTop: -8, marginBottom: 18, lineHeight: 1.5, maxWidth: 600 },
  primaryBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    background: COLORS.primary,
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '9px 14px',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  },
  secondaryBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    background: '#fff',
    color: COLORS.text,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 8,
    padding: '9px 14px',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
  },
  tableWrap: { background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 10, overflow: 'auto' },
  table: { fontSize: 13 },
  th: {
    textAlign: 'left',
    padding: '11px 14px',
    fontSize: 11.5,
    fontWeight: 600,
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    borderBottom: `1px solid ${COLORS.border}`,
    background: '#fafbfc',
  },
  tr: { borderBottom: `1px solid #f1f5f9` },
  td: { padding: '11px 14px' },
  emptyTableCell: { padding: '24px 14px', textAlign: 'center', color: COLORS.textMuted },
  tableActions: { display: 'flex', gap: 6 },
  iconBtn: {
    border: `1px solid ${COLORS.border}`,
    background: '#fff',
    borderRadius: 6,
    padding: 6,
    cursor: 'pointer',
    color: COLORS.textMuted,
    display: 'flex',
  },
  iconBtnDanger: {
    border: `1px solid #fecaca`,
    background: '#fff',
    borderRadius: 6,
    padding: 6,
    cursor: 'pointer',
    color: COLORS.danger,
    display: 'flex',
  },
  stockBadge: {
    background: '#f0fdf4',
    color: '#15803d',
    padding: '3px 9px',
    borderRadius: 12,
    fontSize: 12,
    fontWeight: 600,
  },
  stockBadgeLow: { background: '#fef2f2', color: COLORS.danger },

  // Form
  formField: { marginBottom: 14 },
  formLabel: { display: 'block', fontSize: 12.5, fontWeight: 500, marginBottom: 6, color: COLORS.textMuted },
  formInput: {
    width: '100%',
    padding: '9px 12px',
    border: `1px solid ${COLORS.border}`,
    borderRadius: 7,
    fontSize: 13.5,
    fontFamily: 'inherit',
  },
  formRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  componentRow: { display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' },
  addComponentBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    border: `1px dashed ${COLORS.border}`,
    background: 'transparent',
    borderRadius: 7,
    padding: '8px 12px',
    fontSize: 12.5,
    color: COLORS.primary,
    cursor: 'pointer',
    width: '100%',
    justifyContent: 'center',
  },

  // Bundling
  bundleGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 },
  bundleCard: { background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: 16 },
  bundleCardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  bundleCardName: { fontWeight: 600, fontSize: 14 },
  bundleCardPrices: { display: 'flex', gap: 14, fontSize: 12, color: COLORS.textMuted, marginBottom: 10 },
  bundleCardComponents: { borderTop: `1px solid #f1f5f9`, paddingTop: 8 },
  bundleComponentRow: { display: 'flex', justifyContent: 'space-between', fontSize: 12.5, padding: '3px 0', color: COLORS.text },
  bundleComponentQty: { color: COLORS.textMuted, fontWeight: 600 },

  // Laporan
  statGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginBottom: 18 },
  statCard: { background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: '16px 18px' },
  statCardHighlight: { background: COLORS.primary, borderColor: COLORS.primary },
  statLabel: { display: 'block', fontSize: 12, color: COLORS.textMuted, marginBottom: 6 },
  statValue: { fontSize: 19, fontWeight: 700 },
  insightBanner: {
    background: '#fffbeb',
    border: '1px solid #fde68a',
    color: '#92400e',
    padding: '12px 16px',
    borderRadius: 10,
    fontSize: 13.5,
    marginBottom: 20,
  },
  reportColumns: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 18 },
  reportColumn: {},
  reportColumnTitle: { fontSize: 14, fontWeight: 600, marginBottom: 10 },
  lowStockNote: { color: COLORS.danger, fontWeight: 500, fontSize: 12 },
  sheetLinkBanner: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    background: '#f0f9ff',
    border: '1px solid #bae6fd',
    color: '#075985',
    padding: '12px 16px',
    borderRadius: 10,
    fontSize: 12.5,
    lineHeight: 1.5,
  },
};

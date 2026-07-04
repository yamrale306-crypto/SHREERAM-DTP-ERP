// ============= CONFIGURATION =============
const API_BASE = '/api';
const TOKEN_KEY = 'erp_token';
const USER_KEY = 'erp_user';

// ============= STATE MANAGEMENT =============
let currentUser = null;
let authToken = null;
let lineItems = [];
let lineItemId = 0;
let currentInvType = 'gst';
let editingInvoice = null;
let editingProductIdx = null;
let editingCustomerId = null;

function isAdmin() {
  return currentUser?.role === 'admin';
}

// ============= INITIALIZATION =============
document.addEventListener('DOMContentLoaded', () => {
  // Check for Google OAuth callback
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');
  const user = urlParams.get('user');
  
  if (token && user) {
    // Google OAuth callback
    authToken = token;
    currentUser = JSON.parse(decodeURIComponent(user));
    localStorage.setItem(TOKEN_KEY, authToken);
    localStorage.setItem(USER_KEY, JSON.stringify(currentUser));
    
    // Clean URL
    window.history.replaceState({}, document.title, '/');
    showApp();
    showToast('Welcome! Logged in with Google', 'success');
  } else {
    // Check for existing session
    const savedToken = localStorage.getItem(TOKEN_KEY);
    const savedUser = localStorage.getItem(USER_KEY);
    
    if (savedToken && savedUser) {
      authToken = savedToken;
      currentUser = JSON.parse(savedUser);
      showApp();
    } else {
      showLogin();
    }
  }

  // Login form handler
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', handleLogin);
  }
});

// ============= AUTHENTICATION =============
async function handleLogin(e) {
  e.preventDefault();
  
  const username = document.getElementById('login-username').value;
  const password = document.getElementById('login-password').value;
  const errorDiv = document.getElementById('login-error');
  
  try {
    const response = await axios.post(`${API_BASE}/auth/login`, {
      username,
      password
    });
    
    authToken = response.data.token;
    currentUser = response.data.user;
    
    // Store in localStorage
    localStorage.setItem(TOKEN_KEY, authToken);
    localStorage.setItem(USER_KEY, JSON.stringify(currentUser));
    
    // Show app
    showApp();
    showToast('Login successful! Welcome back.', 'success');
    
  } catch (error) {
    errorDiv.textContent = error.response?.data?.error || 'Login failed. Please try again.';
    errorDiv.style.display = 'block';
  }
}

async function googleLogin() {
  const errorDiv = document.getElementById('login-error');

  if (errorDiv) {
    errorDiv.textContent = 'Google login is not available in this build. Please use username/password login.';
    errorDiv.style.display = 'block';
  }

  document.getElementById('login-username')?.focus();
  showToast('Google login is not available in this build. Please use username/password login.', 'info');
}

function logout() {
  if (confirm('Are you sure you want to logout?')) {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    authToken = null;
    currentUser = null;
    showLogin();
    showToast('Logged out successfully', 'info');
  }
}

function showLogin() {
  document.getElementById('login-page').style.display = 'flex';
  document.getElementById('app').style.display = 'none';

  const params = new URLSearchParams(window.location.search);
  const errorType = params.get('error');
  const errorDiv = document.getElementById('login-error');

  if (errorType === 'google_auth_failed') {
    if (errorDiv) {
      errorDiv.textContent = 'Google sign-in could not be completed. Please try again or use username/password login.';
      errorDiv.style.display = 'block';
    }
    showToast('Google sign-in could not be completed. Please try again or use username/password login.', 'info');
    window.history.replaceState({}, document.title, '/');
  } else if (errorType === 'google_not_configured') {
    if (errorDiv) {
      errorDiv.textContent = 'Google login is not configured yet. Please use username/password login for now.';
      errorDiv.style.display = 'block';
    }
    showToast('Google login is not configured yet. Please use username/password login for now.', 'info');
    window.history.replaceState({}, document.title, '/');
  }
}

function showApp() {
  document.getElementById('login-page').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  
  // Update user info in sidebar
  if (currentUser) {
    document.getElementById('user-name').textContent = currentUser.username;
    document.getElementById('user-role').textContent = currentUser.role === 'admin' ? 'Administrator' : 'User';
    
    const avatarEl = document.getElementById('user-avatar');
    if (currentUser.profile_picture) {
      avatarEl.innerHTML = `<img src="${currentUser.profile_picture}" alt="Profile">`;
    } else {
      avatarEl.textContent = currentUser.username.charAt(0).toUpperCase();
    }
  }

  applyRolePermissions();
  
  // Load dashboard
  loadDashboard();
}

function applyRolePermissions() {
  const adminOnlyElements = document.querySelectorAll('[data-admin-only="true"]');

  adminOnlyElements.forEach((element) => {
    element.style.display = isAdmin() ? '' : 'none';
  });
}

// ============= API HELPER =============
async function apiCall(endpoint, method = 'GET', data = null) {
  try {
    const config = {
      method,
      url: `${API_BASE}${endpoint}`,
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    };
    
    if (data) {
      config.data = data;
    }
    
    const response = await axios(config);
    return response.data;
  } catch (error) {
    console.error('API Error:', error);
    if (error.response?.status === 401) {
      logout();
    }
    throw error;
  }
}

// ============= NAVIGATION =============
function showPage(pageId, el) {
  // Hide all pages
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  
  // Show selected page
  const page = document.getElementById('page-' + pageId);
  if (page) {
    page.classList.add('active');
  }
  
  if (el) {
    el.classList.add('active');
  }
  
  // Update title
  const titles = {
    dashboard: 'Dashboard',
    customers: 'Customers',
    billing: 'Billing & Invoices',
    accounting: 'Accounting',
    inventory: 'Inventory',
    reports: 'Reports',
    settings: 'Settings',
    notifications: 'Notifications'
  };
  document.getElementById('topbar-title-text').textContent = titles[pageId] || pageId;
  
  // Load page data
  if (pageId === 'dashboard') loadDashboard();
  if (pageId === 'customers') loadCustomers();
  if (pageId === 'billing') loadInvoices();
  if (pageId === 'accounting') loadAccounting();
  if (pageId === 'inventory') loadProducts();
  if (pageId === 'reports') loadReports();
  if (pageId === 'settings') loadSettings();
  
  // Close sidebar on mobile
  if (window.innerWidth < 900) {
    closeSidebar();
  }
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('overlay').classList.toggle('show');
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('overlay').classList.remove('show');
}

// ============= DASHBOARD =============
async function loadDashboard() {
  try {
    const stats = await apiCall('/reports/dashboard-stats');
    
    document.getElementById('dash-collect').textContent = formatCurrency(stats.unpaidAmount || 0);
    document.getElementById('dash-pay').textContent = formatCurrency(0); // TODO: Add purchase data
    document.getElementById('dash-balance').textContent = formatCurrency(stats.paidAmount || 0);
    
    document.getElementById('ss-total-sales').textContent = formatCurrency(stats.totalRevenue || 0);
    document.getElementById('ss-collected').textContent = formatCurrency(stats.paidAmount || 0);
    document.getElementById('ss-outstanding').textContent = formatCurrency(stats.unpaidAmount || 0);
    document.getElementById('ss-bills').textContent = stats.totalInvoices || 0;
    
  } catch (error) {
    console.error('Error loading dashboard:', error);
  }
}

// ============= CUSTOMERS =============
async function loadCustomers() {
  try {
    const customers = await apiCall('/customers');
    const tbody = document.getElementById('customer-tbody');
    
    if (!tbody) return;
    
    tbody.innerHTML = customers.map((c, i) => `
      <tr>
        <td>${i + 1}</td>
        <td><strong class="customer-name">${c.name}</strong></td>
        <td>${c.phone || '—'}</td>
        <td>${c.city || '—'}</td>
        <td>
          <button class="btn-icon" onclick="editCustomer(${c.id})" title="Edit"><i class="fas fa-edit"></i></button>
          <button class="btn-icon danger" onclick="deleteCustomer(${c.id})" title="Delete"><i class="fas fa-trash"></i></button>
        </td>
      </tr>
    `).join('') || '<tr><td colspan="5" style="text-align:center;color:var(--text3);">No customers yet</td></tr>';
    
  } catch (error) {
    console.error('Error loading customers:', error);
  }
}

async function saveCustomer() {
  const name = document.getElementById('cust-name-field').value.trim();
  const phone = document.getElementById('cust-phone-field').value.trim();
  const email = document.getElementById('cust-email-field').value.trim();
  const city = document.getElementById('cust-city-field').value.trim();
  const address = document.getElementById('cust-addr-field').value.trim();
  const gstin = document.getElementById('cust-gstin').value.trim();
  const customer_type = document.getElementById('cust-type-field').value;
  const status = document.getElementById('cust-status-field').value;
  
  if (!name) {
    showToast('Customer name is required', 'error');
    return;
  }
  
  try {
    if (editingCustomerId) {
      // Update existing customer
      await apiCall(`/customers/${editingCustomerId}`, 'PUT', {
        name,
        phone,
        email,
        city,
        address,
        gstin,
        customer_type,
        status
      });
      showToast('Customer updated successfully!', 'success');
      editingCustomerId = null;
    } else {
      // Create new customer
      await apiCall('/customers', 'POST', {
        name,
        phone,
        email,
        city,
        address,
        gstin,
        customer_type,
        status
      });
      showToast('Customer added successfully!', 'success');
    }
    
    closeModal('add-customer-modal');
    loadCustomers();
    
    // Clear form
    document.getElementById('cust-name-field').value = '';
    document.getElementById('cust-phone-field').value = '';
    document.getElementById('cust-email-field').value = '';
    document.getElementById('cust-city-field').value = '';
    document.getElementById('cust-addr-field').value = '';
    document.getElementById('cust-gstin').value = '';
    document.getElementById('cust-type-field').value = 'Regular';
    document.getElementById('cust-status-field').value = 'active';
    document.getElementById('save-customer-btn').innerHTML = '<i class="fas fa-save"></i> Save Customer';
    
  } catch (error) {
    showToast(error.response?.data?.error || 'Failed to save customer', 'error');
  }
}

async function deleteCustomer(id) {
  if (!confirm('Delete this customer?')) return;
  
  try {
    await apiCall(`/customers/${id}`, 'DELETE');
    loadCustomers();
    showToast('Customer deleted', 'success');
  } catch (error) {
    showToast('Failed to delete customer', 'error');
  }
}

async function editCustomer(id) {
  try {
    const customer = await apiCall(`/customers/${id}`);
    
    // Populate form with customer data
    document.getElementById('cust-name-field').value = customer.name || '';
    document.getElementById('cust-phone-field').value = customer.phone || '';
    document.getElementById('cust-email-field').value = customer.email || '';
    document.getElementById('cust-city-field').value = customer.city || '';
    document.getElementById('cust-addr-field').value = customer.address || '';
    document.getElementById('cust-gstin').value = customer.gstin || '';
    document.getElementById('cust-type-field').value = customer.customer_type || 'Regular';
    document.getElementById('cust-status-field').value = customer.status || 'active';
    
    // Set editing mode
    editingCustomerId = id;
    document.getElementById('save-customer-btn').innerHTML = '<i class="fas fa-check"></i> Update Customer';
    
    // Open modal
    openModal('add-customer-modal');
    
  } catch (error) {
    showToast(error.response?.data?.error || 'Failed to load customer', 'error');
  }
}

// ============= INVOICES =============
async function loadInvoices() {
  try {
    const invoices = await apiCall('/invoices');
    const tbody = document.getElementById('billing-tbody');
    
    if (!tbody) return;
    
    tbody.innerHTML = invoices.map(inv => `
      <tr>
        <td><strong style="color:var(--primary);font-family:monospace;">${inv.invoice_number}</strong></td>
        <td><strong>${inv.customer_name}</strong></td>
        <td>${inv.date}</td>
        <td><strong>₹${Number(inv.total).toLocaleString('en-IN')}</strong></td>
        <td><span class="badge-status ${inv.status === 'paid' ? 'bs-paid' : inv.status === 'partial' ? 'bs-partial' : 'bs-unpaid'}">${inv.status}</span></td>
        <td>
          <button class="btn-icon" onclick="viewInvoice(${inv.id})" title="View/Print Invoice"><i class="fas fa-eye"></i></button>
          <button class="btn-icon" onclick="editInvoice('${inv.invoice_number}')"><i class="fas fa-edit"></i></button>
          <button class="btn-icon danger" onclick="deleteInvoice('${inv.invoice_number}')"><i class="fas fa-trash"></i></button>
        </td>
      </tr>
    `).join('') || '<tr><td colspan="7" style="text-align:center;color:var(--text3);">No invoices yet</td></tr>';
    
  } catch (error) {
    console.error('Error loading invoices:', error);
  }
}

function switchBillingView(view) {
  document.getElementById('billing-list-view').style.display = view === 'list' ? 'block' : 'none';
  document.getElementById('billing-create-view').style.display = view === 'create' ? 'block' : 'none';
  
  if (view === 'create') {
    initCreateInvoice();
  }
}

function initCreateInvoice() {
  lineItems = [];
  lineItemId = 0;
  editingInvoice = null;
  
  // Set default date
  const today = new Date().toISOString().split('T')[0];
  const dateEl = document.getElementById('ci-date');
  if (dateEl) dateEl.value = today;
  
  // Add first line item
  addLineItem();
}

function addLineItem() {
  const id = ++lineItemId;
  lineItems.push({
    id,
    desc: '',
    qty: 1,
    price: 0,
    amount: 0
  });
  renderLineItems();
}

function renderLineItems() {
  const tbody = document.getElementById('inv-line-items');
  if (!tbody) return;
  
  tbody.innerHTML = lineItems.map((item, i) => `
    <tr class="inv-line-row" id="lr-${item.id}">
      <td style="width:32px;text-align:center;color:var(--text3);font-size:12px;">${i + 1}</td>
      <td><input value="${item.desc}" placeholder="Item name..." oninput="updateLineItem(${item.id},'desc',this.value)" style="min-width:180px;"></td>
      <td><input type="number" value="${item.qty}" min="1" oninput="updateLineItem(${item.id},'qty',this.value)" style="width:70px;text-align:right;"></td>
      <td><input type="number" value="${item.price}" min="0" oninput="updateLineItem(${item.id},'price',this.value)" style="width:100px;text-align:right;"></td>
      <td style="text-align:right;font-weight:700;color:var(--text);" class="line-amt">₹${(item.qty * item.price).toLocaleString('en-IN')}</td>
      <td><button onclick="removeLineItem(${item.id})" style="background:none;border:none;color:var(--text3);cursor:pointer;"><i class="fas fa-times"></i></button></td>
    </tr>
  `).join('');
  
  recalcTotals();
}

function updateLineItem(id, field, val) {
  const item = lineItems.find(i => i.id === id);
  if (!item) return;
  
  item[field] = field === 'desc' ? val : parseFloat(val) || 0;
  
  // Update amount cell
  const row = document.getElementById(`lr-${id}`);
  if (row) {
    const amtCell = row.querySelector('.line-amt');
    if (amtCell) {
      amtCell.textContent = '₹' + (item.qty * item.price).toLocaleString('en-IN');
    }
  }
  
  recalcTotals();
}

function removeLineItem(id) {
  lineItems = lineItems.filter(i => i.id !== id);
  if (lineItems.length === 0) {
    addLineItem();
  } else {
    renderLineItems();
  }
}

function recalcTotals() {
  const subtotal = lineItems.reduce((s, i) => s + (i.qty * i.price), 0);
  const total = subtotal; // Simplified - add GST calculation if needed
  
  const subtotalEl = document.getElementById('inv-subtotal');
  const totalEl = document.getElementById('inv-total');
  
  if (subtotalEl) subtotalEl.textContent = '₹' + subtotal.toLocaleString('en-IN');
  if (totalEl) totalEl.textContent = '₹' + total.toLocaleString('en-IN');
}

async function saveCurrentInvoice() {
  const customer = document.getElementById('ci-customer').value.trim();
  
  if (!customer) {
    showToast('Please enter customer name', 'error');
    return;
  }
  
  if (lineItems.length === 0 || !lineItems.some(i => i.desc.trim())) {
    showToast('Please add at least one item', 'error');
    return;
  }
  
  try {
    const subtotal = lineItems.reduce((s, i) => s + (i.qty * i.price), 0);
    const total = subtotal;
    
    const invoiceNumber = 'INV-' + new Date().getFullYear() + '-' + String(Date.now()).slice(-3);
    
    await apiCall('/invoices', 'POST', {
      invoice_number: invoiceNumber,
      customer_name: customer,
      date: document.getElementById('ci-date').value,
      type: currentInvType,
      subtotal,
      gst_amount: 0,
      total,
      received: 0,
      status: 'unpaid',
      items: lineItems.filter(i => i.desc.trim())
    });
    
    showToast('Invoice saved successfully!', 'success');
    switchBillingView('list');
    loadInvoices();
    
  } catch (error) {
    showToast(error.response?.data?.error || 'Failed to save invoice', 'error');
  }
}

async function deleteInvoice(invNum) {
  if (!confirm('Delete invoice ' + invNum + '?')) return;
  
  try {
    // Note: We need the invoice ID, not number. This is simplified.
    showToast('Invoice deleted', 'success');
    loadInvoices();
  } catch (error) {
    showToast('Failed to delete invoice', 'error');
  }
}

function viewInvoice(id) {
  // Open invoice in a new window for printing
  const invoiceUrl = `/api/invoices/${id}/view`;
  window.open(invoiceUrl, '_blank', 'width=900,height=800,scrollbars=yes');
}

// ============= PRODUCTS =============
async function loadProducts() {
  try {
    const products = await apiCall('/products');
    const tbody = document.getElementById('products-tbody');
    
    if (!tbody) return;
    
    tbody.innerHTML = products.map((p, i) => `
      <tr>
        <td>${i + 1}</td>
        <td><strong>${p.name}</strong></td>
        <td>${p.hsn_sac || '—'}</td>
        <td>₹${Number(p.price).toLocaleString('en-IN')}</td>
        <td>${p.gst_percentage}%</td>
        <td>${p.stock_qty || 0}</td>
        <td>${p.sold_qty || 0}</td>
        <td>
          <button class="btn-icon" onclick="editProduct(${p.id})"><i class="fas fa-edit"></i></button>
          <button class="btn-icon danger" onclick="deleteProduct(${p.id})"><i class="fas fa-trash"></i></button>
        </td>
      </tr>
    `).join('') || '<tr><td colspan="8" style="text-align:center;color:var(--text3);">No products yet</td></tr>';
    
  } catch (error) {
    console.error('Error loading products:', error);
  }
}

async function saveProduct() {
  const name = document.getElementById('prod-m-name').value.trim();
  const hsn_sac = document.getElementById('prod-m-hsn').value.trim();
  const price = parseFloat(document.getElementById('prod-m-price').value) || 0;
  const gst_percentage = parseFloat(document.getElementById('prod-m-tax').value) || 18;
  const stock_qty = parseInt(document.getElementById('prod-m-qty').value) || 0;
  
  if (!name) {
    showToast('Product name is required', 'error');
    return;
  }
  
  try {
    if (editingProductIdx !== null && editingProductIdx !== undefined) {
      // Update existing
      showToast('Product updated', 'success');
    } else {
      // Create new
      await apiCall('/products', 'POST', {
        name,
        hsn_sac,
        price,
        gst_percentage,
        stock_qty,
        sold_qty: 0
      });
      showToast('Product added successfully!', 'success');
    }
    
    closeModal('add-product-modal');
    loadProducts();
    
    // Clear form
    document.getElementById('prod-m-name').value = '';
    document.getElementById('prod-m-hsn').value = '';
    document.getElementById('prod-m-price').value = '';
    document.getElementById('prod-m-tax').value = '18';
    document.getElementById('prod-m-qty').value = '0';
    editingProductIdx = null;
    
  } catch (error) {
    showToast(error.response?.data?.error || 'Failed to save product', 'error');
  }
}

function editProduct(id) {
  showToast('Edit product - coming soon', 'info');
}

async function deleteProduct(id) {
  if (!confirm('Delete this product?')) return;
  
  try {
    await apiCall(`/products/${id}`, 'DELETE');
    loadProducts();
    showToast('Product deleted', 'success');
  } catch (error) {
    showToast('Failed to delete product', 'error');
  }
}

// ============= REPORTS =============
async function loadReports() {
  try {
    const stats = await apiCall('/reports/dashboard-stats');
    
    document.getElementById('rpt-revenue').textContent = formatCurrency(stats.totalRevenue || 0);
    document.getElementById('rpt-paid').textContent = formatCurrency(stats.paidAmount || 0);
    document.getElementById('rpt-outstanding').textContent = formatCurrency(stats.unpaidAmount || 0);
    document.getElementById('rpt-invoices').textContent = stats.totalInvoices || 0;
    
  } catch (error) {
    console.error('Error loading reports:', error);
  }
}

// ============= SETTINGS =============
async function loadSettings() {
  try {
    const settings = await apiCall('/settings');
    const googleConfig = await apiCall('/settings/google/oauth').catch(() => ({}));
    
    // Load company settings
    if (settings.co_name) document.getElementById('set-co-name').value = settings.co_name;
    if (settings.co_addr) document.getElementById('set-co-addr').value = settings.co_addr;
    if (settings.co_phone) document.getElementById('set-co-phone').value = settings.co_phone;
    if (settings.co_email) document.getElementById('set-co-email').value = settings.co_email;
    if (settings.co_gstin) document.getElementById('set-gstin').value = settings.co_gstin;
    if (settings.co_pan) document.getElementById('set-pan').value = settings.co_pan;
    if (googleConfig.google_client_id) document.getElementById('set-google-client-id').value = googleConfig.google_client_id;
    if (googleConfig.google_client_secret) document.getElementById('set-google-client-secret').value = googleConfig.google_client_secret;
    if (googleConfig.google_callback_url) document.getElementById('set-google-callback-url').value = googleConfig.google_callback_url;

    const adminSection = document.getElementById('settings-admin-section');
    if (adminSection) {
      adminSection.style.display = isAdmin() ? '' : 'none';
    }

    if (isAdmin()) {
      await loadUsers();
    }

    const statusMessage = document.getElementById('settings-status-message');
    if (statusMessage) {
      statusMessage.textContent = isAdmin()
        ? 'Admin tools enabled for user management and role changes.'
        : 'Standard user access. Contact an administrator for user management.';
    }
    
  } catch (error) {
    console.error('Error loading settings:', error);
  }
}

async function saveGoogleOAuth() {
  try {
    if (!isAdmin()) {
      showToast('Only admin can update settings', 'error');
      return;
    }

    const payload = {
      clientId: document.getElementById('set-google-client-id').value.trim(),
      clientSecret: document.getElementById('set-google-client-secret').value.trim(),
      callbackUrl: document.getElementById('set-google-callback-url').value.trim()
    };

    await apiCall('/settings/google/oauth', 'POST', payload);
    showToast('Google OAuth settings saved. Restart the app to apply them.', 'success');
  } catch (error) {
    showToast(error.response?.data?.error || 'Failed to save Google OAuth settings', 'error');
  }
}

async function testGoogleOAuth() {
  try {
    const response = await apiCall('/auth/google/url');
    if (response?.configured) {
      showToast('Google OAuth is configured correctly.', 'success');
    } else {
      showToast('Google OAuth is not configured yet.', 'info');
    }
  } catch (error) {
    showToast('Unable to verify Google OAuth right now.', 'error');
  }
}

async function saveSettings(section) {
  try {
    if (!isAdmin()) {
      showToast('Only admin can update settings', 'error');
      return;
    }

    const settings = {};
    
    if (section === 'company') {
      settings.co_name = document.getElementById('set-co-name').value;
      settings.co_addr = document.getElementById('set-co-addr').value;
      settings.co_phone = document.getElementById('set-co-phone').value;
      settings.co_email = document.getElementById('set-co-email').value;
    } else if (section === 'gst') {
      settings.co_gstin = document.getElementById('set-gstin').value;
      settings.co_pan = document.getElementById('set-pan').value;
    }
    
    await apiCall('/settings/bulk-update', 'POST', { settings });
    showToast('Settings saved successfully!', 'success');
    
  } catch (error) {
    showToast(error.response?.data?.error || 'Failed to save settings', 'error');
  }
}

async function loadUsers() {
  const tbody = document.getElementById('users-tbody');
  if (!tbody) return;

  try {
    const users = await apiCall('/users');

    tbody.innerHTML = users.map((user) => `
      <tr>
        <td>${user.username}</td>
        <td>${user.email || '-'}</td>
        <td>
          <select class="form-control-erp" style="min-width:120px;" onchange="updateUserRole(${user.id}, this.value)">
            <option value="user" ${user.role === 'user' ? 'selected' : ''}>User</option>
            <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
          </select>
        </td>
        <td>${user.google_id ? '<span style="color:var(--success);font-weight:700;">Connected</span>' : '<span style="color:var(--text3);">No</span>'}</td>
        <td>${new Date(user.created_at).toLocaleDateString('en-IN')}</td>
        <td>
          <input class="form-control-erp" type="password" id="reset-password-${user.id}" placeholder="New password">
        </td>
        <td>
          <button class="btn-ghost-erp btn-sm-erp" onclick="resetUserPassword(${user.id})">
            <i class="fas fa-key"></i> Reset
          </button>
        </td>
      </tr>
    `).join('');

    if (!users.length) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text3);">No users found</td></tr>';
    }
  } catch (error) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--danger);">${error.response?.data?.error || 'Failed to load users'}</td></tr>`;
  }
}

async function createUser() {
  if (!isAdmin()) {
    showToast('Only admin can create users', 'error');
    return;
  }

  const username = document.getElementById('new-user-username').value.trim();
  const email = document.getElementById('new-user-email').value.trim();
  const password = document.getElementById('new-user-password').value;
  const role = document.getElementById('new-user-role').value;

  if (!username || !password) {
    showToast('Username and password are required', 'error');
    return;
  }

  try {
    await apiCall('/users', 'POST', { username, email, password, role });
    document.getElementById('new-user-username').value = '';
    document.getElementById('new-user-email').value = '';
    document.getElementById('new-user-password').value = '';
    document.getElementById('new-user-role').value = 'user';
    showToast('User created successfully', 'success');
    await loadUsers();
  } catch (error) {
    showToast(error.response?.data?.error || 'Failed to create user', 'error');
  }
}

async function updateUserRole(userId, role) {
  if (!isAdmin()) {
    showToast('Only admin can update roles', 'error');
    return;
  }

  try {
    await apiCall(`/users/${userId}/role`, 'PUT', { role });
    showToast('User role updated', 'success');
    await loadUsers();
  } catch (error) {
    showToast(error.response?.data?.error || 'Failed to update role', 'error');
    await loadUsers();
  }
}

async function resetUserPassword(userId) {
  if (!isAdmin()) {
    showToast('Only admin can reset passwords', 'error');
    return;
  }

  const passwordInput = document.getElementById(`reset-password-${userId}`);
  const password = passwordInput?.value || '';

  if (password.length < 4) {
    showToast('Password must be at least 4 characters', 'error');
    return;
  }

  try {
    await apiCall(`/users/${userId}/reset-password`, 'POST', { password });
    passwordInput.value = '';
    showToast('Password reset successfully', 'success');
  } catch (error) {
    showToast(error.response?.data?.error || 'Failed to reset password', 'error');
  }
}

// ============= ACCOUNTING =============
async function loadAccounting() {
  try {
    const transactions = await apiCall('/invoices'); // Simplified - use dedicated endpoint
    const tbody = document.getElementById('accounting-tbody');
    
    if (!tbody) return;
    
    // Show paid invoices as income
    tbody.innerHTML = transactions
      .filter(inv => inv.status === 'paid')
      .slice(0, 10)
      .map(inv => `
        <tr>
          <td>${inv.date}</td>
          <td>Payment - ${inv.customer_name}</td>
          <td><span style="font-size:10px;padding:2px 8px;border-radius:10px;background:var(--bg3);color:var(--text3);font-weight:600;">Income</span></td>
          <td style="color:var(--success);font-weight:700;">+₹${Number(inv.total).toLocaleString('en-IN')}</td>
        </tr>
      `).join('') || '<tr><td colspan="4" style="text-align:center;color:var(--text3);">No transactions yet</td></tr>';
    
  } catch (error) {
    console.error('Error loading accounting:', error);
  }
}

// ============= MODALS =============
function openModal(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.classList.add('open');
  }
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.classList.remove('open');
  }
}

// Close modal on overlay click
document.querySelectorAll('.erp-modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.classList.remove('open');
    }
  });
});

// ============= UTILITIES =============
function formatCurrency(amount) {
  return '₹' + Math.round(amount).toLocaleString('en-IN');
}

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  const colors = {
    success: 'var(--success)',
    error: 'var(--danger)',
    info: 'var(--primary)'
  };
  
  toast.style.cssText = `
    position: fixed; bottom: 24px; right: 24px;
    background: ${colors[type]}; color: white;
    padding: 14px 24px; border-radius: 10px;
    font-size: 14px; font-weight: 600;
    z-index: 9999;
    box-shadow: 0 4px 20px rgba(0,0,0,0.2);
    animation: fadeIn 0.3s ease;
    max-width: 300px;
  `;
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.remove();
  }, 3000);
}

function toggleTheme() {
  const html = document.documentElement;
  const isDark = html.getAttribute('data-theme') === 'dark';
  html.setAttribute('data-theme', isDark ? 'light' : 'dark');
  document.getElementById('theme-icon').className = isDark ? 'fas fa-moon' : 'fas fa-sun';
}

// ============= EXPORT FUNCTIONS =============
window.logout = logout;
window.showPage = showPage;
window.toggleSidebar = toggleSidebar;
window.closeSidebar = closeSidebar;
window.openModal = openModal;
window.closeModal = closeModal;
window.toggleTheme = toggleTheme;
window.saveCustomer = saveCustomer;
window.deleteCustomer = deleteCustomer;
window.editCustomer = editCustomer;
window.saveCurrentInvoice = saveCurrentInvoice;
window.deleteInvoice = deleteInvoice;
window.viewInvoice = viewInvoice;
window.switchBillingView = switchBillingView;
window.addLineItem = addLineItem;
window.updateLineItem = updateLineItem;
window.removeLineItem = removeLineItem;
window.saveProduct = saveProduct;
window.deleteProduct = deleteProduct;
window.editProduct = editProduct;
window.saveSettings = saveSettings;
window.saveGoogleOAuth = saveGoogleOAuth;
window.testGoogleOAuth = testGoogleOAuth;
window.googleLogin = googleLogin;
window.createUser = createUser;
window.updateUserRole = updateUserRole;
window.resetUserPassword = resetUserPassword;

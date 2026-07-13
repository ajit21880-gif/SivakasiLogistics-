import React, { useEffect, useState } from 'react'
const API_URL = import.meta.env.VITE_API_URL || API_URL + '';


export default function App() {
  // Theme & Auth State
  const [darkTheme, setDarkTheme] = useState(false)
  const [token, setToken] = useState(() => localStorage.getItem('logisticsToken') || '')
  const [user, setUser] = useState(() => {
    const cached = localStorage.getItem('logisticsUser')
    return cached ? JSON.parse(cached) : null
  })

  // Mode States (login vs register)
  const [authMode, setAuthMode] = useState('login') // login, register

  // Login Form States
  const [roleSelection, setRoleSelection] = useState('admin') // admin, staff, customer
  const [loginIdInput, setLoginIdInput] = useState('ADM01')
  const [passwordInput, setPasswordInput] = useState('Demo@123456')
  const [authError, setAuthError] = useState('')
  const [authSuccess, setAuthSuccess] = useState('')

  // Register Form States
  const [registerForm, setRegisterForm] = useState({
    loginId: '',
    email: '',
    phone: '',
    firstName: '',
    lastName: '',
    role: 'staff',
    password: '',
    confirmPassword: ''
  })

  // Active Tab
  const [activeTab, setActiveTab] = useState('dashboard') // dashboard, dataEntry, gdmForm, masters, gcEnquiry, audits, approvals

  // Master Lists
  const [consignors, setConsignors] = useState([])
  const [consignees, setConsignees] = useState([])
  const [lorries, setLorries] = useState([])
  const [consignments, setConsignments] = useState([])
  const [gdmList, setGdmList] = useState([])
  const [auditLogs, setAuditLogs] = useState([])
  
  // Pending Approval Lists (Admin only)
  const [pendingUsers, setPendingUsers] = useState([])
  const [pendingGcs, setPendingGcs] = useState([])
  const [pendingGdms, setPendingGdms] = useState([])
  const [staffList, setStaffList] = useState([])
  const [customerList, setCustomerList] = useState([])

  // Modal and state helpers
  const [loading, setLoading] = useState(false)
  const [showConsignorModal, setShowConsignorModal] = useState(false)
  const [consignorForm, setConsignorForm] = useState({ name: '', origin: 'SIVAKASI', gstn: '', mobile: '' })
  
  const [showConsigneeModal, setShowConsigneeModal] = useState(false)
  const [consigneeForm, setConsigneeForm] = useState({ name: '', destination: '', gstn: '', mobile: '' })

  const [showLorryModal, setShowLorryModal] = useState(false)
  const [lorryForm, setLorryForm] = useState({
    lorryNumber: '', lorryName: '', ownerName: '', ownerContact: '',
    driverName: '', driverContact: '', drivingLicenseNumber: ''
  })

  // Password reset popup
  const [showPasswordChangeModal, setShowPasswordChangeModal] = useState(false)
  const [passwordChangeForm, setPasswordChangeForm] = useState({ oldPassword: 'Demo@123456', newPassword: '', confirmNewPassword: '' })

  // CSV file import state
  const [importType, setImportType] = useState('consignors')
  const [csvContent, setCsvContent] = useState('')

  // Detailed GDM / print overlays
  const [selectedGdm, setSelectedGdm] = useState(null)
  const [selectedGc, setSelectedGc] = useState(null)
  const [gcDispatches, setGcDispatches] = useState([]) // Dispatches for selected GC (Requirement 4)
  const [chatMessages, setChatMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')

  // Search/Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  // Master Data Selected Tab inside Masters Tab
  const [masterSubTab, setMasterSubTab] = useState('consignors') // consignors, consignees, lorries

  // --- FORM STATES: DATA ENTRY TAB ---
  const [gcForm, setGcForm] = useState({
    date: new Date().toISOString().split('T')[0],
    consignorId: '',
    consigneeId: '',
    fromCity: 'SIVAKASI',
    toCity: '',
    invoiceNo: '',
    invoiceDate: '',
    value: 0,
    mark: '',
    godown: '',
    delivery: '',
    hamali: 0,
    stCharges: 0,
    others: 0,
    charWt: 0,
    rateKg: 0,
    serviceTaxPercent: 5,
    paymentStatus: 'To/Pay',
    quantity: 0,
    saidToContainCode: '',
    remarks: '',
    printType: 'LORRY COPY',
    serviceTaxPayableBy: 'Consignee'
  })

  // --- FORM STATES: GDM FORM TAB ---
  const [gdmForm, setGdmForm] = useState({
    fromCity: 'SIVAKASI',
    toCity: '',
    lorryId: '',
    remarks: '',
    items: [], // Array of { goodsConsignmentId: '', desp: 0, serviceTax: 0 }
    deliveryStatus: 'pending'
  })

  // Sync theme
  useEffect(() => {
    if (darkTheme) {
      document.body.classList.add('dark-theme')
    } else {
      document.body.classList.remove('dark-theme')
    }
  }, [darkTheme])

  // Reload data on tab change or login
  useEffect(() => {
    if (token) {
      fetchMasters()
      fetchConsignments()
      fetchGdmList()
      
      if (user?.role === 'admin') {
        fetchAuditLogs()
        fetchAdminApprovals()
      }

      // First time password change enforcement
      if (user?.isDefaultPassword) {
        setShowPasswordChangeModal(true)
      }
    }
  }, [token, activeTab])

  // Poll GDM chat logs when selected
  useEffect(() => {
    if (selectedGdm) {
      fetchChatLogs(selectedGdm.id)
      const timer = setInterval(() => fetchChatLogs(selectedGdm.id), 5000)
      return () => clearInterval(timer)
    }
  }, [selectedGdm])

  // Fills GDM dispatches when GC selected (Requirement 4)
  useEffect(() => {
    if (selectedGc) {
      fetchGcDispatches(selectedGc.id)
    }
  }, [selectedGc])

  // --- RESPONSE HELPER FOR DETAILED ERRORS ---
  async function handleApiResponse(res, defaultMsg) {
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(body.message || defaultMsg);
    }
    return body;
  }

  // --- API FETCH FUNCTIONS ---
  async function fetchMasters() {
    try {
      const headers = { Authorization: 'Bearer ' + token }
      const crRes = await fetch(API_URL + '/v1/master/consignors', { headers })
      if (crRes.ok) setConsignors((await crRes.json()).data || [])

      const ceRes = await fetch(API_URL + '/v1/master/consignees', { headers })
      if (ceRes.ok) setConsignees((await ceRes.json()).data || [])

      const lrRes = await fetch(API_URL + '/v1/master/lorries', { headers })
      if (lrRes.ok) setLorries((await lrRes.json()).data || [])
    } catch (err) {
      console.error(err)
    }
  }

  async function fetchConsignments() {
    try {
      const res = await fetch(API_URL + '/v1/gc', {
        headers: { Authorization: 'Bearer ' + token }
      })
      if (res.ok) setConsignments((await res.json()).data || [])
    } catch (err) {
      console.error(err)
    }
  }

  async function fetchGdmList() {
    setLoading(true)
    try {
      const res = await fetch(API_URL + '/v1/gdm', {
        headers: { Authorization: 'Bearer ' + token }
      })
      if (res.ok) setGdmList((await res.json()).data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function fetchAuditLogs() {
    try {
      const res = await fetch(API_URL + '/v1/gdm/audit-report', {
        headers: { Authorization: 'Bearer ' + token }
      })
      if (res.ok) setAuditLogs((await res.json()).data || [])
    } catch (err) {
      console.error(err)
    }
  }

  async function fetchAdminApprovals() {
    try {
      const headers = { Authorization: 'Bearer ' + token }
      const userRes = await fetch(API_URL + '/v1/auth/users/pending', { headers })
      if (userRes.ok) setPendingUsers((await userRes.json()).data || [])

      const staffRes = await fetch(API_URL + '/v1/auth/users/staff', { headers })
      if (staffRes.ok) setStaffList((await staffRes.json()).data || [])

      const customerRes = await fetch(API_URL + '/v1/auth/users/customers', { headers })
      if (customerRes.ok) setCustomerList((await customerRes.json()).data || [])

      const pendingGcRes = await fetch(API_URL + '/v1/gc?status=PENDING_APPROVAL', { headers })
      if (pendingGcRes.ok) setPendingGcs((await pendingGcRes.json()).data || [])

      const pendingGdmRes = await fetch(API_URL + '/v1/gdm?status=PENDING_APPROVAL', { headers })
      if (pendingGdmRes.ok) setPendingGdms((await pendingGdmRes.json()).data || [])
    } catch (err) {
      console.error(err)
    }
  }

  async function fetchChatLogs(gdmId) {
    try {
      const res = await fetch(`${API_URL}/v1/messages/${gdmId}`, {
        headers: { Authorization: 'Bearer ' + token }
      })
      if (res.ok) setChatMessages((await res.json()).data || [])
    } catch (err) {
      console.error(err)
    }
  }

  async function fetchGcDispatches(gcId) {
    try {
      const res = await fetch(`${API_URL}/v1/gc/${gcId}/dispatches`, {
        headers: { Authorization: 'Bearer ' + token }
      })
      if (res.ok) setGcDispatches((await res.json()).data || [])
    } catch (err) {
      console.error(err)
    }
  }

  // --- ACTIONS ---

  async function handleLogin(e) {
    e.preventDefault()
    setAuthError('')
    setAuthSuccess('')
    try {
      const res = await fetch(API_URL + '/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loginId: loginIdInput.trim(),
          password: passwordInput
        })
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.message || 'Login failed')

      localStorage.setItem('logisticsToken', body.accessToken)
      localStorage.setItem('logisticsUser', JSON.stringify(body.user))
      
      setToken(body.accessToken)
      setUser(body.user)
      setActiveTab('dashboard')
    } catch (err) {
      setAuthError(err.message || String(err))
    }
  }

  async function handleRegister(e) {
    e.preventDefault()
    setAuthError('')
    setAuthSuccess('')

    if (registerForm.password !== registerForm.confirmPassword) {
      setAuthError('Passwords do not match')
      return
    }

    try {
      const res = await fetch(API_URL + '/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loginId: registerForm.loginId.trim(),
          email: registerForm.email.trim(),
          phone: registerForm.phone.trim(),
          firstName: registerForm.firstName.trim(),
          lastName: registerForm.lastName.trim(),
          role: registerForm.role,
          password: registerForm.password
        })
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.message || 'Registration failed')

      setAuthSuccess('Registration successful! Waiting for Admin approval.')
      setAuthMode('login')
      // Reset form
      setRegisterForm({
        loginId: '', email: '', phone: '', firstName: '', lastName: '',
        role: 'staff', password: '', confirmPassword: ''
      })
    } catch (err) {
      setAuthError(err.message || String(err))
    }
  }

  async function handleGoogleLogin() {
    setAuthError('')
    try {
      const res = await fetch(API_URL + '/v1/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idToken: 'mock-google-id-token',
          email: `${roleSelection}-google@example.com`,
          name: `Google ${roleSelection.toUpperCase()}`,
          role: roleSelection
        })
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.message || 'Google authentication failed')

      localStorage.setItem('logisticsToken', body.accessToken)
      localStorage.setItem('logisticsUser', JSON.stringify(body.user))
      
      setToken(body.accessToken)
      setUser(body.user)
      setActiveTab('dashboard')
    } catch (err) {
      setAuthError(err.message || String(err))
    }
  }

  function handleLogout() {
    localStorage.removeItem('logisticsToken')
    localStorage.removeItem('logisticsUser')
    setToken('')
    setUser(null)
    setGdmList([])
    setConsignments([])
    setAuditLogs([])
  }

  // --- PASSWORD UPDATE (Requirement 9) ---
  async function handleChangePassword(e) {
    e.preventDefault()
    if (passwordChangeForm.newPassword !== passwordChangeForm.confirmNewPassword) {
      alert('New passwords do not match')
      return
    }

    try {
      const res = await fetch(API_URL + '/v1/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token
        },
        body: JSON.stringify({
          oldPassword: passwordChangeForm.oldPassword,
          newPassword: passwordChangeForm.newPassword
        })
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.message || 'Password update failed')

      alert('Password updated successfully!')
      setShowPasswordChangeModal(false)
      // Update cached user info
      const updatedUser = { ...user, isDefaultPassword: false }
      setUser(updatedUser)
      localStorage.setItem('logisticsUser', JSON.stringify(updatedUser))
    } catch (err) {
      alert(err.message)
    }
  }

  // --- GC (CONSIGNMENT) CREATION (Requirement 1) ---
  async function handleCreateGc(e, andPrint = false) {
    if (e) e.preventDefault()

    // Validate edit lock
    if (user?.role === 'staff' && user?.staffPermission === 'ENTER_VIEW' && gcForm.id) {
      alert('Permission Denied: You only have view/enter permissions and cannot modify existing records.')
      return
    }

    // Auto-calculate Said to contain description
    let saidToContainDesc = ''
    switch (gcForm.saidToContainCode) {
      case '1': saidToContainDesc = 'FIREWORKS'; break;
      case '2': saidToContainDesc = 'CAPS'; break;
      case '3': saidToContainDesc = 'PRINTED GOODS'; break;
      case '4': saidToContainDesc = 'SAFETY MATCHES'; break;
      case '5': saidToContainDesc = 'OTHERS'; break;
      default: saidToContainDesc = 'OTHERS'; break;
    }

    const payload = {
      ...gcForm,
      value: parseFloat(gcForm.value) || 0.0,
      hamali: parseFloat(gcForm.hamali) || 0.0,
      stCharges: parseFloat(gcForm.stCharges) || 0.0,
      others: parseFloat(gcForm.others) || 0.0,
      charWt: parseFloat(gcForm.charWt) || 0.0,
      rateKg: parseFloat(gcForm.rateKg) || 0.0,
      serviceTaxPercent: parseFloat(gcForm.serviceTaxPercent) || 5.0,
      quantity: parseInt(gcForm.quantity) || 0,
      saidToContainDesc
    }

    try {
      const url = gcForm.id ? `${API_URL}/v1/gc/${gcForm.id}` : API_URL + '/v1/gc'
      const method = gcForm.id ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token
        },
        body: JSON.stringify(payload)
      })

      const body = await res.json()
      if (!res.ok) throw new Error(body.message || 'Operation failed')

      alert(body.message)
      fetchConsignments()

      if (andPrint) {
        // Open Print layout directly
        setSelectedGc(body.data)
        setTimeout(() => window.print(), 500)
      } else {
        setActiveTab('gcEnquiry')
      }

      handleClearGcForm()
    } catch (err) {
      alert(err.message)
    }
  }

  function handleClearGcForm() {
    setGcForm({
      date: new Date().toISOString().split('T')[0],
      consignorId: '',
      consigneeId: '',
      fromCity: 'SIVAKASI',
      toCity: '',
      invoiceNo: '',
      invoiceDate: '',
      value: 0,
      mark: '',
      godown: '',
      delivery: '',
      hamali: 0,
      stCharges: 0,
      others: 0,
      charWt: 0,
      rateKg: 0,
      serviceTaxPercent: 5,
      paymentStatus: 'To/Pay',
      quantity: 0,
      saidToContainCode: '',
      remarks: '',
      printType: 'LORRY COPY',
      serviceTaxPayableBy: 'Consignee'
    })
  }

  // --- GDM (MULTIPLE LOAD) CREATION (Requirement 4) ---
  async function handleCreateGdm(e, andPrint = false) {
    if (e) e.preventDefault()

    if (gdmForm.items.length === 0) {
      alert('Please add at least one consignment to load onto this GDM/Lorry.')
      return
    }

    try {
      const url = gdmForm.id ? `${API_URL}/v1/gdm/${gdmForm.id}` : API_URL + '/v1/gdm'
      const method = gdmForm.id ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token
        },
        body: JSON.stringify(gdmForm)
      })

      const body = await res.json()
      if (!res.ok) throw new Error(body.message || 'GDM operation failed')

      alert(body.message)
      fetchGdmList()

      if (andPrint) {
        setSelectedGdm(body.data)
        setTimeout(() => window.print(), 500)
      } else {
        setActiveTab('gcEnquiry')
      }

      // Reset
      setGdmForm({
        fromCity: 'SIVAKASI',
        toCity: '',
        lorryId: '',
        remarks: '',
        items: [],
        deliveryStatus: 'pending'
      })
    } catch (err) {
      alert(err.message)
    }
  }

  // GDM Loading items triggers
  function addGcToGdm(gcId) {
    const targetGc = consignments.find(c => c.id === gcId)
    if (!targetGc) return

    // Verify if already loaded
    if (gdmForm.items.some(item => item.goodsConsignmentId === gcId)) {
      alert('Consignment already added to lorry load')
      return
    }

    // Default load remaining quantity and proportional service tax
    const newItem = {
      goodsConsignmentId: gcId,
      qty: targetGc.quantity,
      desp: targetGc.quantity, // Default to full load
      serviceTax: targetGc.serviceTax
    }

    setGdmForm({
      ...gdmForm,
      items: [...gdmForm.items, newItem]
    })
  }

  // Update GDM status (Admin/Staff only)
  async function handleUpdateGdmStatus(gdmId, newStatus) {
    try {
      const res = await fetch(`${API_URL}/v1/gdm/${gdmId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token
        },
        body: JSON.stringify({ deliveryStatus: newStatus })
      })
      const body = await handleApiResponse(res, 'Status update failed')
      setSelectedGdm(body.data)
      fetchGdmList()
    } catch (err) {
      alert(err.message)
    }
  }

  function removeGcFromGdm(gcId) {
    setGdmForm({
      ...gdmForm,
      items: gdmForm.items.filter(item => item.goodsConsignmentId !== gcId)
    })
  }

  function updateGdmItemQuantity(gcId, newDesp) {
    setGdmForm({
      ...gdmForm,
      items: gdmForm.items.map(item => {
        if (item.goodsConsignmentId === gcId) {
          const gc = consignments.find(c => c.id === gcId)
          // Fills proportional service tax automatically
          const serviceTax = gc ? (newDesp / gc.quantity) * gc.serviceTax : item.serviceTax
          return { ...item, desp: parseInt(newDesp) || 0, serviceTax: parseFloat(serviceTax.toFixed(2)) }
        }
        return item
      })
    })
  }

  // --- EXCEL/CSV DATA IMPORTER (Requirement 10) ---
  async function handleImportCsv(e) {
    e.preventDefault()
    if (!csvContent.trim()) {
      alert('Please paste or upload CSV content first.')
      return
    }

    try {
      const lines = csvContent.trim().split('\n')
      if (lines.length <= 1) {
        alert('CSV must contain a header row and at least one data row')
        return
      }

      // Parse headers
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
      const dataRows = []

      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue
        const cols = lines[i].split(',').map(c => c.trim())
        const obj = {}
        headers.forEach((h, idx) => {
          obj[h] = cols[idx] || ''
        })
        dataRows.push(obj)
      }

      // Hit specific bulk endpoint
      const res = await fetch(`${API_URL}/v1/master/${importType}/bulk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token
        },
        body: JSON.stringify({ items: dataRows })
      })

      const body = await res.json()
      if (!res.ok) throw new Error(body.message || 'Import failed')

      alert(body.message)
      setCsvContent('')
      fetchMasters()
    } catch (err) {
      alert(err.message)
    }
  }

  // --- ADMIN ACCESS CONTROL & APPROVALS (Requirement 3, 5, 6) ---
  async function handleApproveUser(userId) {
    try {
      const res = await fetch(`${API_URL}/v1/auth/users/${userId}/approve`, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token }
      })
      await handleApiResponse(res, 'Failed to approve')
      alert('User approved successfully!')
      fetchAdminApprovals()
    } catch (err) {
      alert(err.message)
    }
  }

  async function handleRejectUser(userId) {
    try {
      const res = await fetch(`${API_URL}/v1/auth/users/${userId}/reject`, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token }
      })
      await handleApiResponse(res, 'Failed to reject')
      alert('User registration rejected and deleted.')
      fetchAdminApprovals()
    } catch (err) {
      alert(err.message)
    }
  }

  async function handleUpdateStaffPermission(userId, newPermission) {
    try {
      const res = await fetch(`${API_URL}/v1/auth/users/${userId}/staff-permissions`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token
        },
        body: JSON.stringify({ staffPermission: newPermission })
      })
      await handleApiResponse(res, 'Failed to update permission')
      alert('Staff permissions updated!')
      fetchAdminApprovals()
    } catch (err) {
      alert(err.message)
    }
  }

  async function handleLinkCustomer(userId, consignorId, consigneeId) {
    try {
      const res = await fetch(`${API_URL}/v1/auth/users/${userId}/link-customer`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token
        },
        body: JSON.stringify({
          linkedConsignorId: consignorId || null,
          linkedConsigneeId: consigneeId || null
        })
      })
      await handleApiResponse(res, 'Failed to update mapping links')
      alert('Customer mapping link updated successfully!')
      fetchAdminApprovals()
    } catch (err) {
      alert(err.message)
    }
  }

  async function handleApproveGc(gcId) {
    try {
      const res = await fetch(`${API_URL}/v1/gc/${gcId}/approve`, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token }
      })
      await handleApiResponse(res, 'Failed to approve GC')
      alert('Goods Consignment approved!')
      fetchAdminApprovals()
      fetchConsignments()
    } catch (err) {
      alert(err.message)
    }
  }

  async function handleRejectGc(gcId) {
    try {
      const res = await fetch(`${API_URL}/v1/gc/${gcId}/reject`, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token }
      })
      await handleApiResponse(res, 'Failed to reject GC')
      alert('Goods Consignment rejected')
      fetchAdminApprovals()
      fetchConsignments()
    } catch (err) {
      alert(err.message)
    }
  }

  async function handleApproveGdm(gdmId) {
    try {
      const res = await fetch(`${API_URL}/v1/gdm/${gdmId}/approve`, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token }
      })
      await handleApiResponse(res, 'Failed to approve GDM')
      alert('GDM Dispatch approved!')
      fetchAdminApprovals()
      fetchGdmList()
    } catch (err) {
      alert(err.message)
    }
  }

  async function handleRejectGdm(gdmId) {
    try {
      const res = await fetch(`${API_URL}/v1/gdm/${gdmId}/reject`, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token }
      })
      await handleApiResponse(res, 'Failed to reject GDM')
      alert('GDM Dispatch rejected')
      fetchAdminApprovals()
      fetchGdmList()
    } catch (err) {
      alert(err.message)
    }
  }

  // --- CHAT MESSAGING ---
  async function handleSendMessage(e) {
    e.preventDefault()
    if (!newMessage.trim() || !selectedGdm) return
    try {
      const res = await fetch(API_URL + '/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token
        },
        body: JSON.stringify({
          gdmId: selectedGdm.id,
          content: newMessage.trim()
        })
      })
      await handleApiResponse(res, 'Message dispatch failed')
      setNewMessage('')
      fetchChatLogs(selectedGdm.id)
    } catch (err) {
      alert(err.message)
    }
  }

  // --- EXCEL/CSV FILE UPLOAD HELPER ---
  function parseCsvFile(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (evt) => {
      setCsvContent(evt.target.result)
    }
    reader.readAsText(file)
  }

  // Master Data Additions helpers
  async function handleCreateConsignor(e) {
    e.preventDefault()
    try {
      const res = await fetch(API_URL + '/v1/master/consignors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify(consignorForm)
      })
      await handleApiResponse(res, 'Failed to create consignor')
      setShowConsignorModal(false)
      setConsignorForm({ name: '', origin: 'SIVAKASI', gstn: '', mobile: '' })
      fetchMasters()
    } catch (err) { alert(err.message) }
  }

  async function handleCreateConsignee(e) {
    e.preventDefault()
    try {
      const res = await fetch(API_URL + '/v1/master/consignees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify(consigneeForm)
      })
      await handleApiResponse(res, 'Failed to create consignee')
      setShowConsigneeModal(false)
      setConsigneeForm({ name: '', destination: '', gstn: '', mobile: '' })
      fetchMasters()
    } catch (err) { alert(err.message) }
  }

  async function handleCreateLorry(e) {
    e.preventDefault()
    try {
      const res = await fetch(API_URL + '/v1/master/lorries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify(lorryForm)
      })
      await handleApiResponse(res, 'Failed to create lorry')
      setShowLorryModal(false)
      setLorryForm({
        lorryNumber: '', lorryName: '', ownerName: '', ownerContact: '',
        driverName: '', driverContact: '', drivingLicenseNumber: ''
      })
      fetchMasters()
    } catch (err) { alert(err.message) }
  }

  // --- DYNAMIC RUNTIME FORM CALCULATIONS (Requirement 1) ---
  const currentFreight = gcForm.charWt * gcForm.rateKg
  const currentServiceTax = currentFreight * (gcForm.serviceTaxPercent / 100)
  // Freight = Total Cargo Value + ST + Hamali + StCharges + Others (as requested by user)
  const currentTotal = parseFloat(gcForm.value || 0) + currentFreight + currentServiceTax + parseFloat(gcForm.hamali || 0) + parseFloat(gcForm.stCharges || 0) + parseFloat(gcForm.others || 0)

  // GDM Loading totals
  const currentGdmTotalQty = gdmForm.items.reduce((sum, item) => sum + (item.qty || 0), 0)
  const currentGdmTotalDesp = gdmForm.items.reduce((sum, item) => sum + (item.desp || 0), 0)
  const currentGdmTotalServiceTax = gdmForm.items.reduce((sum, item) => sum + (item.serviceTax || 0), 0)

  // Filters
  const filteredConsignments = consignments.filter(c => {
    const gcNo = (c.gcNumber || '').toLowerCase()
    const consName = (c.consignor?.name || '').toLowerCase()
    const ceName = (c.consignee?.name || '').toLowerCase()
    const match = gcNo.includes(searchQuery.toLowerCase()) || consName.includes(searchQuery.toLowerCase()) || ceName.includes(searchQuery.toLowerCase())
    if (statusFilter === 'all') return match
    return match && c.approvalStatus === statusFilter
  })

  const filteredGdms = gdmList.filter(g => {
    const gdmNo = (g.gdmNumber || '').toLowerCase()
    const dest = (g.toCity || '').toLowerCase()
    const lorryNum = (g.lorry?.lorryNumber || '').toLowerCase()
    const match = gdmNo.includes(searchQuery.toLowerCase()) || dest.includes(searchQuery.toLowerCase()) || lorryNum.includes(searchQuery.toLowerCase())
    if (statusFilter === 'all') return match
    return match && g.deliveryStatus === statusFilter
  })

  // --- RENDER COMPONENT ---

  // Auth portal layout
  if (!token) {
    return (
      <div className="auth-container">
        <div className="card auth-card">
          <div className="auth-header">
            <div className="logo-icon" style={{ margin: '0 auto 12px auto' }}>🚛</div>
            <h2 style={{ margin: '8px 0' }}>DEV ROAD LINES</h2>
            <p style={{ color: 'var(--text-muted)', margin: 0 }}>Goods Dispatch Memo Control Desk</p>
          </div>

          {authError && <div className="badge badge-danger" style={{ display: 'block', padding: 12, borderRadius: 8, marginBottom: 16 }}>{authError}</div>}
          {authSuccess && <div className="badge badge-success" style={{ display: 'block', padding: 12, borderRadius: 8, marginBottom: 16 }}>{authSuccess}</div>}

          {authMode === 'login' ? (
            <div>
              <div className="form-group">
                <label>Login Portal Access</label>
                <select 
                  className="form-control" 
                  value={roleSelection} 
                  onChange={(e) => {
                    setRoleSelection(e.target.value)
                    setLoginIdInput(e.target.value === 'admin' ? 'ADM01' : e.target.value === 'staff' ? 'STF01' : 'CST01')
                  }}
                >
                  <option value="admin">Admin Portal</option>
                  <option value="staff">Staff Operations</option>
                  <option value="customer">Customer Tracker</option>
                </select>
              </div>

              <button onClick={handleGoogleLogin} className="btn-google">
                Continue with Google
              </button>

              <div className="divider">Or Sign In with User Credentials</div>

              <form onSubmit={handleLogin}>
                <div className="form-group">
                  <label>Login ID / User ID</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="e.g. ADM01 / STF01 / CST01"
                    value={loginIdInput} 
                    onChange={(e) => setLoginIdInput(e.target.value)} 
                    required 
                  />
                </div>
                <div className="form-group">
                  <label>Password</label>
                  <input 
                    type="password" 
                    className="form-control" 
                    value={passwordInput} 
                    onChange={(e) => setPasswordInput(e.target.value)} 
                    required 
                  />
                </div>
                <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: 12, marginBottom: 16 }}>
                  Log In
                </button>
              </form>

              <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
                Don't have an account? <a href="#" onClick={() => setAuthMode('register')} style={{ color: 'var(--primary)', fontWeight: 600 }}>Register here</a>
              </p>
            </div>
          ) : (
            <div>
              <form onSubmit={handleRegister}>
                <div className="form-group">
                  <label>Role</label>
                  <select 
                    className="form-control" 
                    value={registerForm.role}
                    onChange={(e) => setRegisterForm({ ...registerForm, role: e.target.value })}
                  >
                    <option value="staff">Staff Desk</option>
                    <option value="customer">Customer</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Desired User ID / Login ID</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="e.g. STF03, CST05"
                    value={registerForm.loginId}
                    onChange={(e) => setRegisterForm({ ...registerForm, loginId: e.target.value })}
                    required 
                  />
                </div>
                <div className="form-group">
                  <label>Email Address</label>
                  <input 
                    type="email" 
                    className="form-control" 
                    placeholder="name@example.com"
                    value={registerForm.email}
                    onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
                    required 
                  />
                </div>
                <div className="form-group">
                  <label>Mobile Number</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="Mobile contact"
                    value={registerForm.phone}
                    onChange={(e) => setRegisterForm({ ...registerForm, phone: e.target.value })}
                    required 
                  />
                </div>
                <div className="grid-2" style={{ gap: 8, marginBottom: 0 }}>
                  <div className="form-group">
                    <label>First Name</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      value={registerForm.firstName}
                      onChange={(e) => setRegisterForm({ ...registerForm, firstName: e.target.value })}
                      required 
                    />
                  </div>
                  <div className="form-group">
                    <label>Last Name</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      value={registerForm.lastName}
                      onChange={(e) => setRegisterForm({ ...registerForm, lastName: e.target.value })}
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>Password</label>
                  <input 
                    type="password" 
                    className="form-control" 
                    value={registerForm.password}
                    onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                    required 
                  />
                </div>
                <div className="form-group">
                  <label>Confirm Password</label>
                  <input 
                    type="password" 
                    className="form-control" 
                    value={registerForm.confirmPassword}
                    onChange={(e) => setRegisterForm({ ...registerForm, confirmPassword: e.target.value })}
                    required 
                  />
                </div>
                <button type="submit" className="btn btn-accent" style={{ width: '100%', padding: 12, marginBottom: 16 }}>
                  Register Account
                </button>
              </form>

              <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
                Already registered? <a href="#" onClick={() => setAuthMode('login')} style={{ color: 'var(--primary)', fontWeight: 600 }}>Login here</a>
              </p>
            </div>
          )}
        </div>
      </div>
    )
  }

  // --- LOGGED IN COMPONENT ---
  return (
    <>
      <div className="app-container">
      {/* Sidebar Navigation */}
      <aside className="sidebar no-print">
        <div className="logo-container">
          <div className="logo-icon">🚛</div>
          <span className="logo-text">DEV ROAD LINES</span>
        </div>

        <ul className="nav-menu">
          <li className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>
            <span>📊 Status Dashboard</span>
          </li>
          
          {(user?.role === 'admin' || user?.role === 'staff') && (
            <>
              <li className={`nav-item ${activeTab === 'masters' ? 'active' : ''}`} onClick={() => setActiveTab('masters')}>
                <span>🗄️ Master Database</span>
              </li>
              <li className={`nav-item ${activeTab === 'dataEntry' ? 'active' : ''}`} onClick={() => { handleClearGcForm(); setActiveTab('dataEntry'); }}>
                <span>📝 Consignment Entry (GC)</span>
              </li>
              <li className={`nav-item ${activeTab === 'gdmForm' ? 'active' : ''}`} onClick={() => setActiveTab('gdmForm')}>
                <span>🚚 GDM Loading Form</span>
              </li>
            </>
          )}

          <li className={`nav-item ${activeTab === 'gcEnquiry' ? 'active' : ''}`} onClick={() => setActiveTab('gcEnquiry')}>
            <span>🔍 GC / GDM Enquiry</span>
          </li>

          {user?.role === 'admin' && (
            <>
              <li className={`nav-item ${activeTab === 'approvals' ? 'active' : ''}`} onClick={() => setActiveTab('approvals')}>
                <span>🔒 Admin Approvals & Access</span>
              </li>
              <li className={`nav-item ${activeTab === 'audits' ? 'active' : ''}`} onClick={() => setActiveTab('audits')}>
                <span>🕵️ Audit Trail Logs</span>
              </li>
            </>
          )}
        </ul>

        <div className="sidebar-footer">
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Theme:</span>
            <button onClick={() => setDarkTheme(!darkTheme)} className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: 12 }}>
              {darkTheme ? '☀️ Light' : '🌙 Dark'}
            </button>
          </div>
          <div style={{ fontSize: 13 }}>
            User ID: <strong>{user?.loginId}</strong> <br/>
            Role: <span className="badge badge-primary">{user?.role}</span>
          </div>
          <button onClick={() => setShowPasswordChangeModal(true)} className="btn btn-secondary" style={{ padding: 8, fontSize: 12 }}>
            🔑 Change Password
          </button>
          <button onClick={handleLogout} className="btn btn-danger" style={{ width: '100%' }}>
            Logout
          </button>
        </div>
      </aside>

      {/* Main Container */}
      <main className="main-content">
        <header className="header no-print">
          <div>
            <h1 style={{ marginBottom: 4 }}>DEV ROAD LINES - Logistics Desk</h1>
            <p style={{ color: 'var(--text-muted)', margin: 0 }}>Sivakasi Cracker Fleet Management</p>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={() => { fetchMasters(); fetchConsignments(); fetchGdmList(); if (user?.role === 'admin') fetchAdminApprovals(); }} className="btn btn-secondary">
              🔄 Sync Data
            </button>
          </div>
        </header>

        {/* --- TAB: DASHBOARD --- */}
        {activeTab === 'dashboard' && (
          <div className="no-print">
            <div className="grid-3">
              <div className="card stat-card">
                <div className="stat-label">Active GDM Dispatches</div>
                <div className="stat-value" style={{ color: 'var(--accent)' }}>{gdmList.filter(g => g.deliveryStatus !== 'delivered').length} Loads</div>
                <div className="stat-desc">Currently in transit or loading</div>
              </div>
              <div className="card stat-card">
                <div className="stat-label">Registered Cargo Bookings (GCs)</div>
                <div className="stat-value">{consignments.length} LR Bookings</div>
                <div className="stat-desc">Approved Consignments</div>
              </div>
              <div className="card stat-card">
                <div className="stat-label">Staff Operations Accounts</div>
                <div className="stat-value">{staffList.length || 2} Desks</div>
                <div className="stat-desc">Active logged auditing desks</div>
              </div>
            </div>

            {user?.role === 'customer' && (
              <div className="card">
                <h3>📦 Welcome to Consignment Tracker</h3>
                <p>Track your registered cracker cargo dispatches and contact the lorry driver directly.</p>
                <div className="table-container" style={{ marginTop: 16 }}>
                  <table>
                    <thead>
                      <tr>
                        <th>GC No</th>
                        <th>Invoice No</th>
                        <th>To City</th>
                        <th>Package Qty</th>
                        <th>Total Amount</th>
                        <th>Status</th>
                        <th>Tracking Info</th>
                      </tr>
                    </thead>
                    <tbody>
                      {consignments.map(c => (
                        <tr key={c.id}>
                          <td style={{ fontWeight: 'bold' }}>{c.gcNumber}</td>
                          <td>{c.invoiceNo}</td>
                          <td>{c.toCity}</td>
                          <td>{c.quantity} boxes</td>
                          <td>₹{c.total.toLocaleString()}</td>
                          <td>
                            <span className="badge badge-success">{c.approvalStatus}</span>
                          </td>
                          <td>
                            <button onClick={() => setSelectedGc(c)} className="btn btn-primary" style={{ padding: '6px 12px', fontSize: 12 }}>
                              🔎 View Lorries Used
                            </button>
                          </td>
                        </tr>
                      ))}
                      {consignments.length === 0 && (
                        <tr>
                          <td colSpan="7" style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>
                            No active cargo bookings registered under your Customer ID.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {(user?.role === 'admin' || user?.role === 'staff') && (
              <div className="card">
                <h3>🚛 Active Lorry Dispatch Status Memos</h3>
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>GDM No</th>
                        <th>From ➡️ To</th>
                        <th>Lorry Number</th>
                        <th>Driver Details</th>
                        <th>Boxes Dispatched</th>
                        <th>Delivery Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gdmList.slice(0, 5).map(g => (
                        <tr key={g.id}>
                          <td style={{ fontWeight: 'bold' }}>{g.gdmNumber}</td>
                          <td>{g.fromCity} ➡️ {g.toCity}</td>
                          <td>{g.lorry?.lorryNumber}</td>
                          <td>{g.lorry?.driverName} ({g.lorry?.driverContact})</td>
                          <td>{g.totalDesp} of {g.totalQty}</td>
                          <td>
                            <span className={`badge ${(g.deliveryStatus || 'pending') === 'delivered' ? 'badge-success' : (g.deliveryStatus || 'pending') === 'in_transit' ? 'badge-primary' : 'badge-warning'}`}>
                              {(g.deliveryStatus || 'pending').replace('_', ' ')}
                            </span>
                          </td>
                          <td>
                            <button onClick={() => setSelectedGdm(g)} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: 12 }}>
                              Update / Print
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* --- TAB: MASTER DATABASES --- */}
        {activeTab === 'masters' && (
          <div className="no-print">
            <div className="tabs-bar">
              <button className={`tab-btn ${masterSubTab === 'consignors' ? 'active' : ''}`} onClick={() => setMasterSubTab('consignors')}>
                🏢 Consignor Master
              </button>
              <button className={`tab-btn ${masterSubTab === 'consignees' ? 'active' : ''}`} onClick={() => setMasterSubTab('consignees')}>
                🏪 Consignee Master
              </button>
              <button className={`tab-btn ${masterSubTab === 'lorries' ? 'active' : ''}`} onClick={() => setMasterSubTab('lorries')}>
                🚚 Lorry / Driver Master
              </button>
              <button className={`tab-btn ${masterSubTab === 'bulkImport' ? 'active' : ''}`} onClick={() => setMasterSubTab('bulkImport')}>
                📥 Bulk Excel/CSV Importer
              </button>
            </div>

            {/* Consignor Sub-Tab */}
            {masterSubTab === 'consignors' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', margin: '20px 0' }}>
                  <h3>Consignor List (Sellers)</h3>
                  <button onClick={() => setShowConsignorModal(true)} className="btn btn-primary">
                    ➕ Add Consignor
                  </button>
                </div>
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>Consignor Name</th>
                        <th>Origin Address</th>
                        <th>GSTN</th>
                        <th>Mobile Contact</th>
                      </tr>
                    </thead>
                    <tbody>
                      {consignors.map(c => (
                        <tr key={c.id}>
                          <td style={{ fontWeight: 'bold' }}>{c.name}</td>
                          <td>{c.origin}</td>
                          <td>{c.gstn}</td>
                          <td>{c.mobile}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Consignee Sub-Tab */}
            {masterSubTab === 'consignees' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', margin: '20px 0' }}>
                  <h3>Consignee List (Buyers)</h3>
                  <button onClick={() => setShowConsigneeModal(true)} className="btn btn-primary">
                    ➕ Add Consignee
                  </button>
                </div>
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>Consignee Name</th>
                        <th>Destination City</th>
                        <th>GSTN</th>
                        <th>Mobile Contact</th>
                      </tr>
                    </thead>
                    <tbody>
                      {consignees.map(c => (
                        <tr key={c.id}>
                          <td style={{ fontWeight: 'bold' }}>{c.name}</td>
                          <td>{c.destination}</td>
                          <td>{c.gstn}</td>
                          <td>{c.mobile}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Lorry Sub-Tab */}
            {masterSubTab === 'lorries' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', margin: '20px 0' }}>
                  <h3>Registered Fleet Vehicles (Lorry Master)</h3>
                  <button onClick={() => setShowLorryModal(true)} className="btn btn-primary">
                    ➕ Add Lorry
                  </button>
                </div>
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>Lorry Number</th>
                        <th>Lorry Make</th>
                        <th>Owner Detail</th>
                        <th>Driver Detail</th>
                        <th>Driver License</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lorries.map(l => (
                        <tr key={l.id}>
                          <td style={{ fontWeight: 'bold' }}>{l.lorryNumber}</td>
                          <td>{l.lorryName}</td>
                          <td>{l.ownerName} ({l.ownerContact})</td>
                          <td>{l.driverName} ({l.driverContact})</td>
                          <td>{l.drivingLicenseNumber}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Bulk CSV Import Sub-Tab (Requirement 10) */}
            {masterSubTab === 'bulkImport' && (
              <div className="card" style={{ marginTop: 20 }}>
                <h3>📥 Bulk Import Master Sheets from CSV / Excel format</h3>
                <p style={{ color: 'var(--text-muted)' }}>
                  Upload a CSV file containing records mapped to the headers.
                </p>

                <form onSubmit={handleImportCsv} style={{ marginTop: 24 }}>
                  <div className="grid-2" style={{ gap: 16, marginBottom: 16 }}>
                    <div className="form-group">
                      <label>Select Master Type</label>
                      <select className="form-control" value={importType} onChange={(e) => setImportType(e.target.value)}>
                        <option value="consignors">Consignors Master (Columns: Name, Origin, GSTN, Mobile)</option>
                        <option value="consignees">Consignees Master (Columns: Name, Destination, GSTN, Mobile)</option>
                        <option value="lorries">Lorries Master (Columns: LorryNumber, LorryName, OwnerName, OwnerContact, DriverName, DriverContact, DrivingLicenseNumber)</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Select CSV File</label>
                      <input type="file" accept=".csv" className="form-control" onChange={parseCsvFile} />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>CSV Content Preview / Raw Input</label>
                    <textarea 
                      className="form-control" 
                      style={{ height: 180, fontFamily: 'monospace' }}
                      placeholder={`Name,Origin,GSTN,Mobile\nSivakasi Pyro Corp,Sivakasi,33AAAAA9999Z1Z0,9876543210`}
                      value={csvContent}
                      onChange={(e) => setCsvContent(e.target.value)}
                    ></textarea>
                  </div>

                  <button type="submit" className="btn btn-primary">
                    📤 Run Import Processing
                  </button>
                </form>
              </div>
            )}
          </div>
        )}

        {/* --- TAB: CONSIGNMENT DATA ENTRY (Screenshot 1 format) (Requirement 1) --- */}
        {activeTab === 'dataEntry' && (
          <div className="card no-print" style={{ background: '#f5cba7', color: '#000000', border: '3px solid #b55a00' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #b55a00', paddingBottom: 10, marginBottom: 20 }}>
              <h2 style={{ color: '#000000', margin: 0 }}>🚛 Goods Consignment (GC) / LR Data Entry Form</h2>
              <span style={{ fontSize: 16, fontWeight: 'bold', color: '#7d3c00' }}>DEV ROAD LINES - FY26-27</span>
            </div>

            <form onSubmit={(e) => handleCreateGc(e, false)}>
              <div className="grid-2" style={{ gap: 16, marginBottom: 0 }}>
                {/* Left Column */}
                <div>
                  <div className="grid-2" style={{ gap: 8, marginBottom: 12 }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ color: '#000' }}>Enter Date</label>
                      <input 
                        type="date" 
                        className="form-control" 
                        style={{ background: '#fff', color: '#000', borderColor: '#b55a00' }}
                        value={gcForm.date} 
                        onChange={(e) => setGcForm({ ...gcForm, date: e.target.value })} 
                        required 
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ color: '#000' }}>GC No</label>
                      <input 
                        type="text" 
                        className="form-control" 
                        style={{ background: '#eaeaea', color: '#000', fontWeight: 'bold', borderColor: '#b55a00' }}
                        value={gcForm.gcNumber || 'AUTO-GENERATED'} 
                        disabled 
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label style={{ color: '#000' }}>Consignor (Seller)</label>
                    <select 
                      className="form-control" 
                      style={{ background: '#fff', color: '#000', borderColor: '#b55a00' }}
                      value={gcForm.consignorId}
                      onChange={(e) => {
                        const consignor = consignors.find(c => c.id === e.target.value)
                        setGcForm({ ...gcForm, consignorId: e.target.value, fromCity: consignor ? consignor.origin : 'SIVAKASI' })
                      }}
                      required
                    >
                      <option value="" style={{ color: '#000' }}>-- Select Consignor --</option>
                      {consignors.map(c => <option key={c.id} value={c.id} style={{ color: '#000' }}>{c.name}</option>)}
                    </select>
                  </div>

                  <div className="form-group">
                    <label style={{ color: '#000' }}>From City</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      style={{ background: '#fff', color: '#000', borderColor: '#b55a00' }}
                      value={gcForm.fromCity} 
                      onChange={(e) => setGcForm({ ...gcForm, fromCity: e.target.value })} 
                    />
                  </div>

                  <div className="grid-2" style={{ gap: 8, marginBottom: 12 }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ color: '#000' }}>Invoice No</label>
                      <input 
                        type="text" 
                        className="form-control" 
                        style={{ background: '#fff', color: '#000', borderColor: '#b55a00' }}
                        value={gcForm.invoiceNo} 
                        onChange={(e) => setGcForm({ ...gcForm, invoiceNo: e.target.value })} 
                        required 
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ color: '#000' }}>Invoice Date</label>
                      <input 
                        type="date" 
                        className="form-control" 
                        style={{ background: '#fff', color: '#000', borderColor: '#b55a00' }}
                        value={gcForm.invoiceDate} 
                        onChange={(e) => setGcForm({ ...gcForm, invoiceDate: e.target.value })} 
                      />
                    </div>
                  </div>

                  <div className="grid-2" style={{ gap: 8, marginBottom: 12 }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ color: '#000' }}>Mark</label>
                      <input 
                        type="text" 
                        className="form-control" 
                        style={{ background: '#fff', color: '#000', borderColor: '#b55a00' }}
                        value={gcForm.mark} 
                        onChange={(e) => setGcForm({ ...gcForm, mark: e.target.value })} 
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ color: '#000' }}>Godown</label>
                      <input 
                        type="text" 
                        className="form-control" 
                        style={{ background: '#fff', color: '#000', borderColor: '#b55a00' }}
                        value={gcForm.godown} 
                        onChange={(e) => setGcForm({ ...gcForm, godown: e.target.value })} 
                      />
                    </div>
                  </div>

                  <div className="grid-3" style={{ gap: 8, marginBottom: 12 }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ color: '#000' }}>Hamali (₹)</label>
                      <input 
                        type="number" 
                        className="form-control" 
                        style={{ background: '#fff', color: '#000', borderColor: '#b55a00' }}
                        value={gcForm.hamali} 
                        onChange={(e) => setGcForm({ ...gcForm, hamali: e.target.value })} 
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ color: '#000' }}>St. Charges (₹)</label>
                      <input 
                        type="number" 
                        className="form-control" 
                        style={{ background: '#fff', color: '#000', borderColor: '#b55a00' }}
                        value={gcForm.stCharges} 
                        onChange={(e) => setGcForm({ ...gcForm, stCharges: e.target.value })} 
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ color: '#000' }}>Others (₹)</label>
                      <input 
                        type="number" 
                        className="form-control" 
                        style={{ background: '#fff', color: '#000', borderColor: '#b55a00' }}
                        value={gcForm.others} 
                        onChange={(e) => setGcForm({ ...gcForm, others: e.target.value })} 
                      />
                    </div>
                  </div>

                  <div className="grid-3" style={{ gap: 8, marginBottom: 12 }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ color: '#000' }}>Char: Wt (kg)</label>
                      <input 
                        type="number" 
                        className="form-control" 
                        style={{ background: '#fff', color: '#000', borderColor: '#b55a00' }}
                        value={gcForm.charWt} 
                        onChange={(e) => setGcForm({ ...gcForm, charWt: e.target.value })} 
                        required 
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ color: '#000' }}>Rate/Kg (₹)</label>
                      <input 
                        type="number" 
                        className="form-control" 
                        style={{ background: '#fff', color: '#000', borderColor: '#b55a00' }}
                        value={gcForm.rateKg} 
                        onChange={(e) => setGcForm({ ...gcForm, rateKg: e.target.value })} 
                        required 
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ color: '#000' }}>Freight (₹)</label>
                      <input 
                        type="text" 
                        className="form-control" 
                        style={{ background: '#eaeaea', color: '#000', fontWeight: 'bold', borderColor: '#b55a00' }}
                        value={currentFreight} 
                        disabled 
                      />
                    </div>
                  </div>

                  <div className="grid-2" style={{ gap: 8, marginBottom: 12 }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ color: '#000' }}>Payment Status</label>
                      <select 
                        className="form-control" 
                        style={{ background: '#fff', color: '#000', borderColor: '#b55a00' }}
                        value={gcForm.paymentStatus}
                        onChange={(e) => setGcForm({ ...gcForm, paymentStatus: e.target.value })}
                      >
                        <option value="To/Pay">To/Pay</option>
                        <option value="Paid">Paid</option>
                        <option value="TBB">TBB (To Be Billed)</option>
                      </select>
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ color: '#000' }}>Box Quantity</label>
                      <input 
                        type="number" 
                        className="form-control" 
                        style={{ background: '#fff', color: '#000', borderColor: '#b55a00' }}
                        value={gcForm.quantity} 
                        onChange={(e) => setGcForm({ ...gcForm, quantity: e.target.value })} 
                        required 
                      />
                    </div>
                  </div>
                </div>

                {/* Right Column */}
                <div>
                  <div className="form-group">
                    <label style={{ color: '#000' }}>Consignee (Buyer)</label>
                    <select 
                      className="form-control" 
                      style={{ background: '#fff', color: '#000', borderColor: '#b55a00' }}
                      value={gcForm.consigneeId}
                      onChange={(e) => {
                        const consignee = consignees.find(c => c.id === e.target.value)
                        setGcForm({ ...gcForm, consigneeId: e.target.value, toCity: consignee ? consignee.destination : '' })
                      }}
                      required
                    >
                      <option value="" style={{ color: '#000' }}>-- Select Consignee --</option>
                      {consignees.map(c => <option key={c.id} value={c.id} style={{ color: '#000' }}>{c.name}</option>)}
                    </select>
                  </div>

                  <div className="form-group">
                    <label style={{ color: '#000' }}>To City</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      style={{ background: '#fff', color: '#000', borderColor: '#b55a00' }}
                      value={gcForm.toCity} 
                      onChange={(e) => setGcForm({ ...gcForm, toCity: e.target.value })} 
                    />
                  </div>

                  <div className="grid-2" style={{ gap: 8, marginBottom: 12 }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ color: '#000' }}>Cargo Value (₹)</label>
                      <input 
                        type="number" 
                        className="form-control" 
                        style={{ background: '#fff', color: '#000', borderColor: '#b55a00' }}
                        value={gcForm.value} 
                        onChange={(e) => setGcForm({ ...gcForm, value: e.target.value })} 
                        required 
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ color: '#000' }}>Delivery Method</label>
                      <input 
                        type="text" 
                        className="form-control" 
                        style={{ background: '#fff', color: '#000', borderColor: '#b55a00' }}
                        value={gcForm.delivery} 
                        onChange={(e) => setGcForm({ ...gcForm, delivery: e.target.value })} 
                      />
                    </div>
                  </div>

                  <div className="grid-2" style={{ gap: 8, marginBottom: 12 }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ color: '#000' }}>Service Tax %</label>
                      <input 
                        type="number" 
                        className="form-control" 
                        style={{ background: '#fff', color: '#000', borderColor: '#b55a00' }}
                        value={gcForm.serviceTaxPercent} 
                        onChange={(e) => setGcForm({ ...gcForm, serviceTaxPercent: e.target.value })} 
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ color: '#000' }}>Service Tax (₹)</label>
                      <input 
                        type="text" 
                        className="form-control" 
                        style={{ background: '#eaeaea', color: '#000', fontWeight: 'bold', borderColor: '#b55a00' }}
                        value={currentServiceTax.toFixed(2)} 
                        disabled 
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label style={{ color: '#000' }}>Total Billing Amount (₹)</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      style={{ background: '#eaeaea', color: '#ff0000', fontWeight: '800', fontSize: 18, borderColor: '#b55a00' }}
                      value={`₹${currentTotal.toFixed(2)}`} 
                      disabled 
                    />
                    <small style={{ color: '#5f2c00', display: 'block', marginTop: 4 }}>
                      Calculation: Value + Freight + ST + Hamali + Stationary + Others
                    </small>
                  </div>

                  <div className="form-group">
                    <label style={{ color: '#000', fontWeight: 'bold' }}>Said To Contain</label>
                    <select 
                      className="form-control" 
                      style={{ background: '#fff', color: '#000', borderColor: '#b55a00', marginBottom: 8 }}
                      value={gcForm.saidToContainCode}
                      onChange={(e) => setGcForm({ ...gcForm, saidToContainCode: e.target.value })}
                    >
                      <option value="">-- Select Code --</option>
                      <option value="1">1 = FWs (Fireworks)</option>
                      <option value="2">2 = Caps</option>
                      <option value="3">3 = PGoods (Paper Goods)</option>
                      <option value="4">4 = Smatches (Safety Matches)</option>
                      <option value="5">5 = Others</option>
                    </select>
                    <input 
                      type="text" 
                      className="form-control" 
                      placeholder="Autopopulated Description" 
                      style={{ background: '#eaeaea', color: '#000', borderColor: '#b55a00' }}
                      value={
                        gcForm.saidToContainCode === '1' ? 'FIREWORKS' :
                        gcForm.saidToContainCode === '2' ? 'CAPS' :
                        gcForm.saidToContainCode === '3' ? 'PRINTED GOODS' :
                        gcForm.saidToContainCode === '4' ? 'SAFETY MATCHES' :
                        gcForm.saidToContainCode === '5' ? 'OTHERS' : ''
                      }
                      disabled
                    />
                  </div>

                  <div className="form-group">
                    <label style={{ color: '#000' }}>Remarks</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      style={{ background: '#fff', color: '#000', borderColor: '#b55a00' }}
                      value={gcForm.remarks} 
                      onChange={(e) => setGcForm({ ...gcForm, remarks: e.target.value })} 
                    />
                  </div>

                  <div className="form-group">
                    <label style={{ color: '#000' }}>Print Type</label>
                    <select 
                      className="form-control" 
                      style={{ background: '#fff', color: '#000', borderColor: '#b55a00' }}
                      value={gcForm.printType}
                      onChange={(e) => setGcForm({ ...gcForm, printType: e.target.value })}
                    >
                      <option value="LORRY COPY">LORRY COPY</option>
                      <option value="CONSIGNOR COPY">CONSIGNOR COPY</option>
                      <option value="CONSIGNEE COPY">CONSIGNEE COPY</option>
                      <option value="OFFICE COPY">OFFICE COPY</option>
                    </select>
                  </div>

                  <div className="form-group" style={{ marginBottom: 12 }}>
                    <label style={{ color: '#000', display: 'block', marginBottom: 6 }}>Service Tax Payable By</label>
                    <div style={{ display: 'flex', gap: 16 }}>
                      {['Consignee', 'Consignor', 'Transporter'].map((item) => (
                        <label key={item} style={{ color: '#000', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
                          <input 
                            type="radio" 
                            name="stPayable" 
                            value={item} 
                            checked={gcForm.serviceTaxPayableBy === item}
                            onChange={(e) => setGcForm({ ...gcForm, serviceTaxPayableBy: e.target.value })}
                          /> {item}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', borderTop: '2px solid #b55a00', paddingTop: 16, marginTop: 16 }}>
                <button type="button" onClick={(e) => handleCreateGc(null, true)} className="btn btn-accent" style={{ background: '#b55a00', color: '#fff' }}>
                  Save & Print
                </button>
                <button type="submit" className="btn btn-primary" style={{ background: '#000', color: '#fff' }}>
                  Save
                </button>
                <button type="button" onClick={() => setActiveTab('gcEnquiry')} className="btn btn-secondary" style={{ background: '#7d3c00', color: '#fff' }}>
                  List
                </button>
                <button type="button" onClick={handleClearGcForm} className="btn btn-secondary" style={{ background: '#bbb', color: '#000' }}>
                  Clear
                </button>
                <button type="button" onClick={() => setActiveTab('dashboard')} className="btn btn-danger" style={{ background: '#c0392b', color: '#fff' }}>
                  Exit
                </button>
              </div>
            </form>
          </div>
        )}

        {/* --- TAB: GDM FORM (Screenshot 2 format) (Requirement 4) --- */}
        {activeTab === 'gdmForm' && (
          <div className="card no-print" style={{ background: '#f39c12', color: '#000', border: '3px solid #d35400' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #d35400', paddingBottom: 10, marginBottom: 20 }}>
              <h2 style={{ color: '#000', margin: 0 }}>🚚 Lorry Loading & Goods Dispatch Memo (GDM) Form</h2>
              <span style={{ fontSize: 16, fontWeight: 'bold', color: '#6e2c00' }}>DEV ROAD LINES - DISPATCH DESK</span>
            </div>

            <form onSubmit={(e) => handleCreateGdm(e, false)}>
              <div className="grid-3" style={{ gap: 12, marginBottom: 0 }}>
                <div className="form-group">
                  <label style={{ color: '#000' }}>GDM Number (GC No)</label>
                  <input type="text" className="form-control" style={{ background: '#eaeaea', color: '#000', borderColor: '#d35400' }} value={gdmForm.gdmNumber || 'AUTO-GENERATED'} disabled />
                </div>
                <div className="form-group">
                  <label style={{ color: '#000' }}>GDM Date</label>
                  <input type="date" className="form-control" style={{ background: '#fff', color: '#000', borderColor: '#d35400' }} value={gdmForm.gdmDate || new Date().toISOString().split('T')[0]} disabled />
                </div>
                <div className="form-group">
                  <label style={{ color: '#000' }}>Remarks</label>
                  <input type="text" className="form-control" style={{ background: '#fff', color: '#000', borderColor: '#d35400' }} value={gdmForm.remarks} onChange={(e) => setGdmForm({ ...gdmForm, remarks: e.target.value })} />
                </div>
              </div>

              <div className="grid-2" style={{ gap: 12, marginBottom: 0 }}>
                <div className="form-group">
                  <label style={{ color: '#000' }}>From City</label>
                  <input type="text" className="form-control" style={{ background: '#fff', color: '#000', borderColor: '#d35400' }} value={gdmForm.fromCity} onChange={(e) => setGdmForm({ ...gdmForm, fromCity: e.target.value })} />
                </div>
                <div className="form-group">
                  <label style={{ color: '#000' }}>To City (Destination)</label>
                  <input type="text" className="form-control" style={{ background: '#fff', color: '#000', borderColor: '#d35400' }} value={gdmForm.toCity} onChange={(e) => setGdmForm({ ...gdmForm, toCity: e.target.value })} required />
                </div>
              </div>

              <div className="grid-3" style={{ gap: 12, marginBottom: 0 }}>
                <div className="form-group">
                  <label style={{ color: '#000' }}>Select Lorry vehicle</label>
                  <select 
                    className="form-control" 
                    style={{ background: '#fff', color: '#000', borderColor: '#d35400' }}
                    value={gdmForm.lorryId}
                    onChange={(e) => setGdmForm({ ...gdmForm, lorryId: e.target.value })}
                    required
                  >
                    <option value="">-- Choose Lorry --</option>
                    {lorries.map(l => <option key={l.id} value={l.id}>{l.lorryNumber}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label style={{ color: '#000' }}>Lorry Name</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    style={{ background: '#eaeaea', color: '#000', borderColor: '#d35400' }}
                    value={lorries.find(l => l.id === gdmForm.lorryId)?.lorryName || ''} 
                    disabled 
                  />
                </div>
                <div className="form-group">
                  <label style={{ color: '#000' }}>Owner Name</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    style={{ background: '#eaeaea', color: '#000', borderColor: '#d35400' }}
                    value={lorries.find(l => l.id === gdmForm.lorryId)?.ownerName || ''} 
                    disabled 
                  />
                </div>
              </div>

              <div className="grid-2" style={{ gap: 12, marginBottom: 12 }}>
                <div className="form-group">
                  <label style={{ color: '#000' }}>Driver Details (License)</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    style={{ background: '#eaeaea', color: '#000', borderColor: '#d35400' }}
                    value={
                      (() => {
                        const l = lorries.find(l => l.id === gdmForm.lorryId)
                        return l ? `${l.driverName} - ${l.drivingLicenseNumber}` : ''
                      })()
                    } 
                    disabled 
                  />
                </div>

                {/* Aggregate Summary displays top-right */}
                <div style={{ display: 'flex', gap: 8, background: '#f5b041', padding: 8, borderRadius: 8 }}>
                  <div style={{ flex: 1, textAlign: 'center' }}>
                    <label style={{ color: '#000', fontSize: 12, fontWeight: 'bold' }}>Total Qty</label>
                    <input type="text" className="form-control" style={{ background: '#fff', color: '#000', textAlign: 'center', height: 32, padding: 4 }} value={currentGdmTotalQty} disabled />
                  </div>
                  <div style={{ flex: 1, textAlign: 'center' }}>
                    <label style={{ color: '#000', fontSize: 12, fontWeight: 'bold' }}>Total Desp</label>
                    <input type="text" className="form-control" style={{ background: '#fff', color: '#000', textAlign: 'center', height: 32, padding: 4 }} value={currentGdmTotalDesp} disabled />
                  </div>
                  <div style={{ flex: 1, textAlign: 'center' }}>
                    <label style={{ color: '#000', fontSize: 12, fontWeight: 'bold' }}>Total Service Tax</label>
                    <input type="text" className="form-control" style={{ background: '#fff', color: '#000', textAlign: 'center', height: 32, padding: 4 }} value={`₹${currentGdmTotalServiceTax}`} disabled />
                  </div>
                </div>
              </div>

              {/* Load picker segment */}
              <div className="card" style={{ background: '#fff', padding: 12, border: '1px solid #d35400', marginBottom: 20 }}>
                <h4 style={{ color: '#000', margin: '0 0 10px 0' }}>📦 Pick Consignments (GCs) to Load onto Lorry</h4>
                <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 8 }}>
                  {consignments.filter(c => c.approvalStatus === 'APPROVED' && !gdmForm.items.some(loaded => loaded.goodsConsignmentId === c.id)).map(c => (
                    <div 
                      key={c.id} 
                      onClick={() => addGcToGdm(c.id)}
                      style={{ 
                        background: '#eaeaea', border: '1px solid #999', borderRadius: 6, 
                        padding: '6px 12px', cursor: 'pointer', fontSize: 13, color: '#000', whiteSpace: 'nowrap'
                      }}
                    >
                      ➕ <strong>{c.gcNumber}</strong> ({c.consignee?.name} - {c.quantity} boxes)
                    </div>
                  ))}
                  {consignments.filter(c => c.approvalStatus === 'APPROVED' && !gdmForm.items.some(loaded => loaded.goodsConsignmentId === c.id)).length === 0 && (
                    <p style={{ color: '#666', fontSize: 13, margin: 0 }}>No approved consignments ready for loading.</p>
                  )}
                </div>
              </div>

              {/* Table of loaded items */}
              <div className="table-container" style={{ background: '#fff', border: '2px solid #d35400', marginBottom: 20 }}>
                <table>
                  <thead>
                    <tr>
                      <th style={{ color: '#000' }}>Lr No (GC No)</th>
                      <th style={{ color: '#000' }}>Godc (Godown)</th>
                      <th style={{ color: '#000' }}>Consignor</th>
                      <th style={{ color: '#000' }}>Consignee</th>
                      <th style={{ color: '#000' }}>Bill (Invoice No)</th>
                      <th style={{ color: '#000' }}>Value</th>
                      <th style={{ color: '#000' }}>Service Tax</th>
                      <th style={{ color: '#000' }}>Qty</th>
                      <th style={{ color: '#000' }}>Desp (Input Loaded Packages)</th>
                      <th style={{ color: '#000' }}>Remove</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gdmForm.items.map((item, idx) => {
                      const gc = consignments.find(c => c.id === item.goodsConsignmentId)
                      return (
                        <tr key={idx} style={{ color: '#000' }}>
                          <td><strong>{gc?.gcNumber}</strong></td>
                          <td>{gc?.godown}</td>
                          <td>{gc?.consignor?.name}</td>
                          <td>{gc?.consignee?.name}</td>
                          <td>{gc?.invoiceNo}</td>
                          <td>₹{gc?.value}</td>
                          <td>₹{item.serviceTax}</td>
                          <td>{item.qty} boxes</td>
                          <td>
                            <input 
                              type="number" 
                              className="form-control" 
                              style={{ width: 100, height: 32, background: '#fff', color: '#000', borderColor: '#d35400' }}
                              value={item.desp} 
                              onChange={(e) => updateGdmItemQuantity(item.goodsConsignmentId, e.target.value)}
                              max={item.qty}
                              min={0}
                            />
                          </td>
                          <td>
                            <button type="button" onClick={() => removeGcFromGdm(item.goodsConsignmentId)} className="btn btn-danger" style={{ padding: '4px 8px', fontSize: 12 }}>
                              ❌
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                    {gdmForm.items.length === 0 && (
                      <tr>
                        <td colSpan="10" style={{ textAlign: 'center', padding: 16, color: '#666' }}>No consignments added to lorry fleet list yet. Pick them above.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: 10, justifySelf: 'end', borderTop: '2px solid #d35400', paddingTop: 16 }}>
                <button type="button" onClick={() => handleCreateGdm(null, true)} className="btn btn-accent" style={{ background: '#d35400', color: '#fff' }}>
                  Save & Print
                </button>
                <button type="submit" className="btn btn-primary" style={{ background: '#000', color: '#fff' }}>
                  Save
                </button>
                <button type="button" onClick={() => setGdmForm({ fromCity: 'SIVAKASI', toCity: '', lorryId: '', remarks: '', items: [], deliveryStatus: 'pending' })} className="btn btn-secondary" style={{ background: '#e67e22', color: '#fff' }}>
                  Clear
                </button>
                <button type="button" onClick={() => setActiveTab('gcEnquiry')} className="btn btn-secondary" style={{ background: '#7e5109', color: '#fff' }}>
                  List
                </button>
                <button type="button" onClick={() => setActiveTab('dashboard')} className="btn btn-danger" style={{ background: '#c0392b', color: '#fff' }}>
                  Exit
                </button>
              </div>
            </form>
          </div>
        )}

        {/* --- TAB: GC/GDM ENQUIRY TAB --- */}
        {activeTab === 'gcEnquiry' && (
          <div className="card no-print">
            <h2>🔎 Goods Consignment (GC) & Lorry Memos (GDM) Enquiry Search</h2>
            <div style={{ display: 'flex', gap: 12, margin: '16px 0 24px 0' }}>
              <input 
                type="text" 
                className="form-control" 
                placeholder="Search GC Number, GDM number, Consignor Name, or Destination..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <select 
                className="form-control" 
                style={{ width: 220 }}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All Items</option>
                <option value="APPROVED">Approved GCs</option>
                <option value="PENDING_APPROVAL">Pending Approval GCs</option>
                <option value="REJECTED">Rejected GCs</option>
                <option value="in_transit">In Transit GDMs</option>
                <option value="delivered">Delivered GDMs</option>
              </select>
            </div>

            <div className="grid-2">
              <div>
                <h3>Consignments (GCs/LRs)</h3>
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>GC No</th>
                        <th>Consignor ➡️ Consignee</th>
                        <th>Invoice No</th>
                        <th>Approval Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredConsignments.map(c => (
                        <tr key={c.id}>
                          <td style={{ fontWeight: 'bold' }}>{c.gcNumber}</td>
                          <td>{c.consignor?.name} ➡️ {c.consignee?.name}</td>
                          <td>{c.invoiceNo}</td>
                          <td>
                            <span className={`badge ${c.approvalStatus === 'APPROVED' ? 'badge-success' : c.approvalStatus === 'PENDING_APPROVAL' ? 'badge-warning' : 'badge-danger'}`}>
                              {c.approvalStatus}
                            </span>
                          </td>
                          <td style={{ display: 'flex', gap: 6 }}>
                            <button onClick={() => setSelectedGc(c)} className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: 12 }}>
                              🔎 View Details
                            </button>
                            <button onClick={() => { setSelectedGc(c); setTimeout(() => window.print(), 500); }} className="btn btn-accent" style={{ padding: '4px 8px', fontSize: 12 }}>
                              🖨️ Print
                            </button>
                            {user?.role === 'admin' && (
                              <button 
                                onClick={() => {
                                  setGcForm(c)
                                  setActiveTab('dataEntry')
                                }} 
                                className="btn btn-primary" 
                                style={{ padding: '4px 8px', fontSize: 12 }}
                              >
                                ✏️ Edit
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <h3>Dispatch Lorry Memos (GDMs)</h3>
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>GDM No</th>
                        <th>Destination</th>
                        <th>Lorry Number</th>
                        <th>Delivery Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredGdms.map(g => (
                        <tr key={g.id}>
                          <td style={{ fontWeight: 'bold' }}>{g.gdmNumber}</td>
                          <td>{g.toCity}</td>
                          <td>{g.lorry?.lorryNumber}</td>
                          <td>
                            <span className={`badge ${g.deliveryStatus === 'delivered' ? 'badge-success' : g.deliveryStatus === 'in_transit' ? 'badge-primary' : 'badge-warning'}`}>
                              {g.deliveryStatus}
                            </span>
                          </td>
                          <td style={{ display: 'flex', gap: 6 }}>
                            <button onClick={() => setSelectedGdm(g)} className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: 12 }}>
                              🔎 Track
                            </button>
                            <button onClick={() => { setSelectedGdm(g); setTimeout(() => window.print(), 500); }} className="btn btn-accent" style={{ padding: '4px 8px', fontSize: 12 }}>
                              🖨️ Print
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* --- TAB: AUDIT TRAILS --- */}
        {activeTab === 'audits' && (
          <div className="card no-print">
            <h2>🕵️ Report Audit Trails (Admin Logs)</h2>
            <p>Full record of GDM edits and updates saved by operations staff.</p>
            <div className="table-container" style={{ marginTop: 20 }}>
              <table>
                <thead>
                  <tr>
                    <th>GDM No</th>
                    <th>To Destination</th>
                    <th>Status</th>
                    <th>Audit User ID</th>
                    <th>Author Name</th>
                    <th>Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map((log, idx) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: 'bold' }}>{log.gdmNumber}</td>
                      <td>{log.toCity}</td>
                      <td>
                        <span className={`badge ${log.deliveryStatus === 'delivered' ? 'badge-success' : log.warning ? 'badge-warning' : 'badge-primary'}`}>
                          {log.deliveryStatus}
                        </span>
                      </td>
                      <td><code>{log.lastUpdatedBy}</code></td>
                      <td>{log.lastUpdatedByName}</td>
                      <td>{new Date(log.updatedAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* --- TAB: ADMIN APPROVALS & ACCESS CONTROL (Requirement 3, 5, 6) --- */}
        {activeTab === 'approvals' && (
          <div className="no-print">
            {/* User Approvals */}
            <div className="card">
              <h3>🔒 User Registration Approvals</h3>
              <p style={{ color: 'var(--text-muted)' }}>Approve self-registered staff or customer accounts before login is enabled.</p>
              <div className="table-container" style={{ marginTop: 16 }}>
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Phone</th>
                      <th>User ID (Login ID)</th>
                      <th>Requested Role</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingUsers.map(u => (
                      <tr key={u.id}>
                        <td style={{ fontWeight: 'bold' }}>{u.firstName} {u.lastName}</td>
                        <td>{u.email}</td>
                        <td>{u.phone}</td>
                        <td><code>{u.loginId}</code></td>
                        <td><span className="badge badge-primary">{u.role}</span></td>
                        <td style={{ display: 'flex', gap: 8 }}>
                          <button onClick={() => handleApproveUser(u.id)} className="btn btn-success" style={{ padding: '6px 12px', fontSize: 12 }}>
                            Approve
                          </button>
                          <button onClick={() => handleRejectUser(u.id)} className="btn btn-danger" style={{ padding: '6px 12px', fontSize: 12 }}>
                            Reject
                          </button>
                        </td>
                      </tr>
                    ))}
                    {pendingUsers.length === 0 && (
                      <tr>
                        <td colSpan="6" style={{ textAlign: 'center', padding: 16, color: 'var(--text-muted)' }}>No pending user registrations.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Staff Permission Level configuration */}
            <div className="card">
              <h3>⚙️ Staff Access & Permission Management</h3>
              <p style={{ color: 'var(--text-muted)' }}>Configure whether a staff member can edit GC entries or only enter/view them.</p>
              <div className="table-container" style={{ marginTop: 16 }}>
                <table>
                  <thead>
                    <tr>
                      <th>Staff Name</th>
                      <th>User ID</th>
                      <th>Current Permission Level</th>
                      <th>Update Access Control</th>
                    </tr>
                  </thead>
                  <tbody>
                    {staffList.map(st => (
                      <tr key={st.id}>
                        <td style={{ fontWeight: 'bold' }}>{st.firstName} {st.lastName}</td>
                        <td><code>{st.loginId}</code></td>
                        <td>
                          <span className={`badge ${st.staffPermission === 'EDIT' ? 'badge-success' : 'badge-warning'}`}>
                            {st.staffPermission === 'EDIT' ? 'EDIT & WRITE' : 'ENTER & VIEW ONLY'}
                          </span>
                        </td>
                        <td>
                          <select 
                            className="form-control" 
                            style={{ width: 200 }}
                            value={st.staffPermission}
                            onChange={(e) => handleUpdateStaffPermission(st.id, e.target.value)}
                          >
                            <option value="EDIT">Full Edit & Modify</option>
                            <option value="ENTER_VIEW">Enter & View Only</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Customer linked mapping */}
            <div className="card">
              <h3>🏪 Link Customers to Master Registry</h3>
              <p style={{ color: 'var(--text-muted)' }}>Map customer login accounts to their specific Consignor/Consignee profile records.</p>
              <div className="table-container" style={{ marginTop: 16 }}>
                <table>
                  <thead>
                    <tr>
                      <th>Customer login</th>
                      <th>User ID</th>
                      <th>Linked Consignor Profile</th>
                      <th>Linked Consignee Profile</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customerList.map(c => {
                      let tempConsignorId = c.linkedConsignorId || ''
                      let tempConsigneeId = c.linkedConsigneeId || ''
                      return (
                        <tr key={c.id}>
                          <td style={{ fontWeight: 'bold' }}>{c.firstName} {c.lastName}</td>
                          <td><code>{c.loginId}</code></td>
                          <td>
                            <select 
                              className="form-control"
                              defaultValue={tempConsignorId}
                              onChange={(e) => tempConsignorId = e.target.value}
                            >
                              <option value="">-- None --</option>
                              {consignors.map(con => <option key={con.id} value={con.id}>{con.name}</option>)}
                            </select>
                          </td>
                          <td>
                            <select 
                              className="form-control"
                              defaultValue={tempConsigneeId}
                              onChange={(e) => tempConsigneeId = e.target.value}
                            >
                              <option value="">-- None --</option>
                              {consignees.map(co => <option key={co.id} value={co.id}>{co.name}</option>)}
                            </select>
                          </td>
                          <td>
                            <button 
                              onClick={() => handleLinkCustomer(c.id, tempConsignorId, tempConsigneeId)} 
                              className="btn btn-primary" 
                              style={{ padding: '6px 12px', fontSize: 12 }}
                            >
                              Save Mappings
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Consignment Approvals */}
            <div className="card">
              <h3>📝 Staff Consignment Entries (GC) Waiting for Review</h3>
              <div className="table-container" style={{ marginTop: 16 }}>
                <table>
                  <thead>
                    <tr>
                      <th>GC No</th>
                      <th>Invoice No</th>
                      <th>From ➡️ To</th>
                      <th>Amount</th>
                      <th>Staff Author</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingGcs.map(g => (
                      <tr key={g.id}>
                        <td style={{ fontWeight: 'bold' }}>{g.gcNumber}</td>
                        <td>{g.invoiceNo}</td>
                        <td>{g.fromCity} ➡️ {g.toCity}</td>
                        <td>₹{g.total.toLocaleString()}</td>
                        <td>{g.enteredByName}</td>
                        <td style={{ display: 'flex', gap: 8 }}>
                          <button onClick={() => handleApproveGc(g.id)} className="btn btn-success" style={{ padding: '6px 12px', fontSize: 12 }}>
                            Approve
                          </button>
                          <button onClick={() => handleRejectGc(g.id)} className="btn btn-danger" style={{ padding: '6px 12px', fontSize: 12 }}>
                            Reject
                          </button>
                        </td>
                      </tr>
                    ))}
                    {pendingGcs.length === 0 && (
                      <tr>
                        <td colSpan="6" style={{ textAlign: 'center', padding: 16, color: 'var(--text-muted)' }}>No consignments pending approval.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* GDM Approvals */}
            <div className="card">
              <h3>🚚 Staff Lorry Dispatch Memos (GDM) Waiting for Review</h3>
              <div className="table-container" style={{ marginTop: 16 }}>
                <table>
                  <thead>
                    <tr>
                      <th>GDM No</th>
                      <th>Destination</th>
                      <th>Lorry Number</th>
                      <th>Packages Dispatched</th>
                      <th>Staff Author</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingGdms.map(g => (
                      <tr key={g.id}>
                        <td style={{ fontWeight: 'bold' }}>{g.gdmNumber}</td>
                        <td>{g.toCity}</td>
                        <td>{g.lorry?.lorryNumber}</td>
                        <td>{g.totalDesp} boxes</td>
                        <td>{g.enteredByName}</td>
                        <td style={{ display: 'flex', gap: 8 }}>
                          <button onClick={() => handleApproveGdm(g.id)} className="btn btn-success" style={{ padding: '6px 12px', fontSize: 12 }}>
                            Approve
                          </button>
                          <button onClick={() => handleRejectGdm(g.id)} className="btn btn-danger" style={{ padding: '6px 12px', fontSize: 12 }}>
                            Reject
                          </button>
                        </td>
                      </tr>
                    ))}
                    {pendingGdms.length === 0 && (
                      <tr>
                        <td colSpan="6" style={{ textAlign: 'center', padding: 16, color: 'var(--text-muted)' }}>No dispatch GDM memos pending approval.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* --- DETAILED GDM TRACKING / MESSAGE CARRIER MODAL --- */}
        {selectedGdm && (
          <div className="payment-overlay no-print">
            <div className="payment-modal" style={{ maxWidth: 700 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
                <h3>Track Dispatch Memo: {selectedGdm.gdmNumber}</h3>
                <button onClick={() => setSelectedGdm(null)} className="btn btn-secondary" style={{ padding: '6px 12px' }}>
                  Close
                </button>
              </div>

              {/* Delivery Timeline Stepper */}
              <div className="timeline">
                <div className={`timeline-step ${['pending', 'loaded', 'in_transit', 'delivered'].includes(selectedGdm.deliveryStatus) ? 'active' : ''} ${['loaded', 'in_transit', 'delivered'].includes(selectedGdm.deliveryStatus) ? 'completed' : ''}`}>
                  <div className="step-node">1</div>
                  <div className="step-label">Pending</div>
                </div>
                <div className={`timeline-step ${['loaded', 'in_transit', 'delivered'].includes(selectedGdm.deliveryStatus) ? 'active' : ''} ${['in_transit', 'delivered'].includes(selectedGdm.deliveryStatus) ? 'completed' : ''}`}>
                  <div className="step-node">2</div>
                  <div className="step-label">Loaded</div>
                </div>
                <div className={`timeline-step ${['in_transit', 'delivered'].includes(selectedGdm.deliveryStatus) ? 'active' : ''} ${selectedGdm.deliveryStatus === 'delivered' ? 'completed' : ''}`}>
                  <div className="step-node">3</div>
                  <div className="step-label">In Transit</div>
                </div>
                <div className={`timeline-step ${selectedGdm.deliveryStatus === 'delivered' ? 'active completed' : ''}`}>
                  <div className="step-node">4</div>
                  <div className="step-label">Delivered</div>
                </div>
              </div>

              <div className="grid-2" style={{ gap: 16, marginBottom: 16 }}>
                <div>
                  <h4>Consignments Dispatched</h4>
                  {selectedGdm.items?.map((item, idx) => (
                    <div key={idx} style={{ padding: '4px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                      <strong>{item.consignment?.gcNumber}</strong>: {item.desp} boxes ➡️ {item.consignment?.consignee?.name}
                    </div>
                  ))}
                  <p style={{ marginTop: 10 }}><strong>Total Box Load:</strong> {selectedGdm.totalDesp} boxes</p>
                </div>
                <div>
                  <h4>Lorry & Driver Details</h4>
                  <p><strong>Lorry Reg #:</strong> {selectedGdm.lorry?.lorryNumber} ({selectedGdm.lorry?.lorryName})</p>
                  <p><strong>Lorry Owner:</strong> {selectedGdm.lorry?.ownerName} ({selectedGdm.lorry?.ownerContact})</p>
                  <p><strong>Driver Name:</strong> {selectedGdm.lorry?.driverName} ({selectedGdm.lorry?.driverContact})</p>
                  <p><strong>License:</strong> {selectedGdm.lorry?.drivingLicenseNumber}</p>
                </div>
              </div>

              {/* Status Update Form (Admin/Staff only) */}
              {(user?.role === 'admin' || user?.role === 'staff') && (
                <div className="card" style={{ padding: 16, background: 'rgba(99, 102, 241, 0.05)', marginBottom: 20 }}>
                  <h4 style={{ margin: '0 0 12px 0' }}>⚙️ Dispatch Status Control</h4>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <button onClick={() => handleUpdateGdmStatus(selectedGdm.id, 'loaded')} className="btn btn-secondary" style={{ flex: 1, padding: 8 }}>
                      Mark Loaded
                    </button>
                    <button onClick={() => handleUpdateGdmStatus(selectedGdm.id, 'in_transit')} className="btn btn-primary" style={{ flex: 1, padding: 8 }}>
                      Dispatch Truck
                    </button>
                    <button onClick={() => handleUpdateGdmStatus(selectedGdm.id, 'delivered')} className="btn btn-accent" style={{ flex: 1, padding: 8 }}>
                      Deliver Load
                    </button>
                  </div>
                </div>
              )}

              {/* Communication Chat box */}
              <div>
                <h4>✉️ Contact Lorry Owner (Chat / Email)</h4>
                <div className="chat-window">
                  <div className="chat-messages">
                    {chatMessages.map((msg, idx) => (
                      <div key={idx} className={`chat-bubble ${msg.senderId === user?.id ? 'sent' : 'received'}`}>
                        <strong>{msg.senderName}</strong>: <br/>
                        {msg.content}
                      </div>
                    ))}
                  </div>
                  <form onSubmit={handleSendMessage} style={{ display: 'flex', borderTop: '1px solid var(--border)' }}>
                    <input 
                      type="text" 
                      className="form-control" 
                      placeholder="Write message to owner..." 
                      style={{ border: 'none', borderRadius: 0 }}
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      required
                    />
                    <button type="submit" className="btn btn-primary" style={{ borderRadius: 0, padding: '0 20px' }}>
                      Send
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* --- DETAILED GC VIEW MODAL (Requirement 4: multiple lorry dispatches) --- */}
        {selectedGc && (
          <div className="payment-overlay no-print">
            <div className="payment-modal" style={{ maxWidth: 700 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
                <h3>Goods Consignment Details: {selectedGc.gcNumber}</h3>
                <button onClick={() => setSelectedGc(null)} className="btn btn-secondary" style={{ padding: '6px 12px' }}>
                  Close
                </button>
              </div>

              <div className="grid-2" style={{ gap: 16, marginBottom: 16 }}>
                <div>
                  <h4>Consignment Notes</h4>
                  <p><strong>Consignor:</strong> {selectedGc.consignor?.name} ({selectedGc.fromCity})</p>
                  <p><strong>Consignee:</strong> {selectedGc.consignee?.name} ({selectedGc.toCity})</p>
                  <p><strong>GSTN ID:</strong> {selectedGc.consignee?.gstn}</p>
                  <p><strong>Invoice No:</strong> {selectedGc.invoiceNo}</p>
                  <p><strong>Total Package Count:</strong> {selectedGc.quantity} boxes</p>
                </div>
                <div>
                  <h4>Freight Charges Breakdown</h4>
                  <p><strong>Freight (Char Wt * Rate):</strong> ₹{selectedGc.freight}</p>
                  <p><strong>Hamali charges:</strong> ₹{selectedGc.hamali}</p>
                  <p><strong>Stationary charges:</strong> ₹{selectedGc.stCharges}</p>
                  <p><strong>Others:</strong> ₹{selectedGc.others}</p>
                  <p><strong>Service Tax ({selectedGc.serviceTaxPercent}%):</strong> ₹{selectedGc.serviceTax}</p>
                  <p><strong>Total Amount (with Cargo Value):</strong> <strong>₹{selectedGc.total.toLocaleString()}</strong></p>
                </div>
              </div>

              {/* Lorries used (Requirement 4) */}
              <div>
                <h4>🚚 Lorries Used for this Shipment</h4>
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>GDM Memo No</th>
                        <th>Lorry Number</th>
                        <th>Driver Details</th>
                        <th>Packages Dispatched</th>
                        <th>Delivery Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gcDispatches.map((disp, idx) => (
                        <tr key={idx}>
                          <td><strong>{disp.gdmNumber}</strong></td>
                          <td>{disp.lorryNumber}</td>
                          <td>{disp.driverName} ({disp.driverContact})</td>
                          <td>{disp.despQty} of {disp.totalQty}</td>
                          <td>
                            <span className="badge badge-primary">{disp.deliveryStatus}</span>
                          </td>
                        </tr>
                      ))}
                      {gcDispatches.length === 0 && (
                        <tr>
                          <td colSpan="5" style={{ textAlign: 'center', padding: 12, color: 'var(--text-muted)' }}>
                            No active dispatch lorry memos mapped to this consignment.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}



        {/* --- MODAL: CONSIGNOR MASTER CREATION --- */}
        {showConsignorModal && (
          <div className="payment-overlay no-print">
            <div className="payment-modal" style={{ maxWidth: 440 }}>
              <h3>🏢 Add Consignor Master</h3>
              <form onSubmit={handleCreateConsignor}>
                <div className="form-group">
                  <label>Consignor Company Name</label>
                  <input type="text" className="form-control" value={consignorForm.name} onChange={(e) => setConsignorForm({ ...consignorForm, name: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label>Origin Address (City)</label>
                  <input type="text" className="form-control" value={consignorForm.origin} onChange={(e) => setConsignorForm({ ...consignorForm, origin: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label>GSTN Number (15 digits)</label>
                  <input type="text" className="form-control" maxLength="15" value={consignorForm.gstn} onChange={(e) => setConsignorForm({ ...consignorForm, gstn: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label>Mobile Contact Number</label>
                  <input type="text" className="form-control" value={consignorForm.mobile} onChange={(e) => setConsignorForm({ ...consignorForm, mobile: e.target.value })} required />
                </div>
                <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                  <button type="button" onClick={() => setShowConsignorModal(false)} className="btn btn-secondary">Cancel</button>
                  <button type="submit" className="btn btn-primary">Create Master</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* --- MODAL: CONSIGNEE MASTER CREATION --- */}
        {showConsigneeModal && (
          <div className="payment-overlay no-print">
            <div className="payment-modal" style={{ maxWidth: 440 }}>
              <h3>🏪 Add Consignee Master</h3>
              <form onSubmit={handleCreateConsignee}>
                <div className="form-group">
                  <label>Consignee Name</label>
                  <input type="text" className="form-control" value={consigneeForm.name} onChange={(e) => setConsigneeForm({ ...consigneeForm, name: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label>Destination City</label>
                  <input type="text" className="form-control" value={consigneeForm.destination} onChange={(e) => setConsigneeForm({ ...consigneeForm, destination: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label>GSTN Number (15 digits)</label>
                  <input type="text" className="form-control" maxLength="15" value={consigneeForm.gstn} onChange={(e) => setConsigneeForm({ ...consigneeForm, gstn: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label>Mobile Contact Number</label>
                  <input type="text" className="form-control" value={consigneeForm.mobile} onChange={(e) => setConsigneeForm({ ...consigneeForm, mobile: e.target.value })} required />
                </div>
                <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                  <button type="button" onClick={() => setShowConsigneeModal(false)} className="btn btn-secondary">Cancel</button>
                  <button type="submit" className="btn btn-primary">Create Master</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* --- MODAL: LORRY MASTER CREATION --- */}
        {showLorryModal && (
          <div className="payment-overlay no-print">
            <div className="payment-modal">
              <h3>🚚 Add Lorry & Driver Details</h3>
              <form onSubmit={handleCreateLorry}>
                <div className="grid-2" style={{ gap: 12, marginBottom: 0 }}>
                  <div className="form-group">
                    <label>Lorry Registration #</label>
                    <input type="text" className="form-control" placeholder="e.g. TN-67-A-1234" value={lorryForm.lorryNumber} onChange={(e) => setLorryForm({ ...lorryForm, lorryNumber: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label>Lorry Make/Name</label>
                    <input type="text" className="form-control" placeholder="e.g. Ashok Leyland" value={lorryForm.lorryName} onChange={(e) => setLorryForm({ ...lorryForm, lorryName: e.target.value })} required />
                  </div>
                </div>
                <div className="grid-2" style={{ gap: 12, marginBottom: 0 }}>
                  <div className="form-group">
                    <label>Lorry Owner Name</label>
                    <input type="text" className="form-control" value={lorryForm.ownerName} onChange={(e) => setLorryForm({ ...lorryForm, ownerName: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label>Owner Contact Mobile</label>
                    <input type="text" className="form-control" value={lorryForm.ownerContact} onChange={(e) => setLorryForm({ ...lorryForm, ownerContact: e.target.value })} required />
                  </div>
                </div>
                <div className="grid-3" style={{ gap: 12, marginBottom: 0 }}>
                  <div className="form-group">
                    <label>Driver Name</label>
                    <input type="text" className="form-control" value={lorryForm.driverName} onChange={(e) => setLorryForm({ ...lorryForm, driverName: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label>Driver Mobile</label>
                    <input type="text" className="form-control" value={lorryForm.driverContact} onChange={(e) => setLorryForm({ ...lorryForm, driverContact: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label>Driving License #</label>
                    <input type="text" className="form-control" value={lorryForm.drivingLicenseNumber} onChange={(e) => setLorryForm({ ...lorryForm, drivingLicenseNumber: e.target.value })} required />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                  <button type="button" onClick={() => setShowLorryModal(false)} className="btn btn-secondary">Cancel</button>
                  <button type="submit" className="btn btn-primary">Register Lorry</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* --- MODAL: MANDATORY PASSWORD CHANGE --- */}
        {showPasswordChangeModal && (
          <div className="payment-overlay no-print" style={{ zIndex: 2000 }}>
            <div className="payment-modal" style={{ maxWidth: 440 }}>
              <h3 style={{ color: 'var(--danger)' }}>🔑 Update Password</h3>
              <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                Your account is currently using a default temporary password. You are required to update it to continue.
              </p>
              <form onSubmit={handleChangePassword}>
                <div className="form-group">
                  <label>Current Temporary Password</label>
                  <input 
                    type="password" 
                    className="form-control" 
                    value={passwordChangeForm.oldPassword} 
                    onChange={(e) => setPasswordChangeForm({ ...passwordChangeForm, oldPassword: e.target.value })} 
                    required 
                  />
                </div>
                <div className="form-group">
                  <label>New Secure Password (min 6 characters)</label>
                  <input 
                    type="password" 
                    className="form-control" 
                    placeholder="Enter new password"
                    value={passwordChangeForm.newPassword} 
                    onChange={(e) => setPasswordChangeForm({ ...passwordChangeForm, newPassword: e.target.value })} 
                    required 
                  />
                </div>
                <div className="form-group">
                  <label>Confirm New Password</label>
                  <input 
                    type="password" 
                    className="form-control" 
                    placeholder="Confirm new password"
                    value={passwordChangeForm.confirmNewPassword} 
                    onChange={(e) => setPasswordChangeForm({ ...passwordChangeForm, confirmNewPassword: e.target.value })} 
                    required 
                  />
                </div>
                <button type="submit" className="btn btn-danger" style={{ width: '100%', padding: 12 }}>
                  Save Secure Password & Continue
                </button>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>

    {/* --- PRINT SHEET FOR GOODS DISPATCH MEMO (GDM) (Screenshot 3 format) --- */}
    {selectedGdm && (
      <div className="printable-sheet">
        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #000', paddingBottom: 8 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 'bold' }}>DEV ROAD LINES</h2>
            <p style={{ margin: '4px 0', fontSize: 12 }}>410-JAWAHARLAL NEHRU ROAD</p>
            <p style={{ margin: '4px 0', fontSize: 12 }}>SIVAKASI-626123</p>
            <p style={{ margin: '4px 0', fontSize: 12 }}>9443854679, 9025090388</p>
            <p style={{ margin: '4px 0', fontSize: 12, fontWeight: 'bold' }}>GSTIN: 33AAQFD6720J1ZA</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <h3 style={{ margin: 0, textTransform: 'uppercase', letterSpacing: 1 }}>Goods Dispatch Memo</h3>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', margin: '12px 0', fontSize: 13, borderBottom: '1px solid #000', paddingBottom: 8 }}>
          <div>
            <p style={{ margin: '3px 0' }}><strong>From:</strong> {selectedGdm.fromCity}</p>
            <p style={{ margin: '3px 0' }}><strong>Lorry No:</strong> {selectedGdm.lorry?.lorryNumber}</p>
          </div>
          <div>
            <p style={{ margin: '3px 0' }}><strong>To:</strong> {selectedGdm.toCity}</p>
          </div>
          <div>
            <p style={{ margin: '3px 0' }}><strong>GDM No:</strong> {selectedGdm.gdmNumber}</p>
            <p style={{ margin: '3px 0' }}><strong>GDM Dt:</strong> {new Date(selectedGdm.gdmDate).toLocaleDateString('en-GB')}</p>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>CN No</th>
              <th>Consignor</th>
              <th>Consignee</th>
              <th>Desc</th>
              <th style={{ textAlign: 'right' }}>Wt.</th>
              <th style={{ textAlign: 'right' }}>Pkgs</th>
              <th style={{ textAlign: 'right' }}>Freight</th>
            </tr>
          </thead>
          <tbody>
            {selectedGdm.items?.map((item, idx) => (
              <tr key={idx}>
                <td>{item.consignment?.gcNumber}</td>
                <td>{item.consignment?.consignor?.name.substring(0, 24)}</td>
                <td>{item.consignment?.consignee?.name.substring(0, 24)}</td>
                <td>{item.consignment?.saidToContainDesc}</td>
                <td style={{ textAlign: 'right' }}>{item.consignment?.charWt}</td>
                <td style={{ textAlign: 'right' }}>{item.desp}</td>
                <td style={{ textAlign: 'right' }}>₹{item.consignment?.freight.toFixed(2)}</td>
              </tr>
            ))}
            <tr className="total-row">
              <td colSpan="4"><strong>TOTALS</strong></td>
              <td style={{ textAlign: 'right' }}></td>
              <td style={{ textAlign: 'right' }}><strong>{selectedGdm.totalDesp} PKGS</strong></td>
              <td style={{ textAlign: 'right' }}><strong>₹{selectedGdm.totalServiceTax.toFixed(2)}</strong></td>
            </tr>
          </tbody>
        </table>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 40, fontSize: 12 }}>
          <div>
            <p style={{ borderTop: '1px solid #000', width: 180, textAlign: 'center', paddingTop: 4 }}>Prepared By</p>
          </div>
          <div>
            <p style={{ borderTop: '1px solid #000', width: 180, textAlign: 'center', paddingTop: 4 }}>Authorized Signature</p>
          </div>
        </div>
      </div>
    )}

    {/* --- PRINT SHEET FOR GOODS CONSIGNMENT (GC / Lorry Receipt) --- */}
    {selectedGc && (
      <div className="printable-sheet">
        <div style={{ border: '2px solid #000', padding: 12 }}>
          <div style={{ textAlign: 'center', borderBottom: '2px solid #000', paddingBottom: 8 }}>
            <h2 style={{ margin: 0, fontSize: 24 }}>DEV ROAD LINES</h2>
            <p style={{ margin: '4px 0', fontSize: 12 }}>Sivakasi Branch, Tamil Nadu. Ph: 9443854679</p>
            <h3 style={{ margin: '8px 0 0 0', textDecoration: 'underline' }}>GOODS CONSIGNMENT NOTE (LR)</h3>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', margin: '12px 0', fontSize: 13, borderBottom: '1px solid #000', paddingBottom: 8 }}>
            <div>
              <p><strong>LR Number:</strong> {selectedGc.gcNumber}</p>
              <p><strong>Date:</strong> {new Date(selectedGc.date).toLocaleDateString('en-GB')}</p>
              <p><strong>From:</strong> {selectedGc.fromCity}</p>
              <p><strong>To:</strong> {selectedGc.toCity}</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p><strong>Invoice No:</strong> {selectedGc.invoiceNo}</p>
              <p><strong>Cargo Value:</strong> ₹{selectedGc.value}</p>
              <p><strong>Status:</strong> {selectedGc.paymentStatus}</p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 20, fontSize: 13, marginBottom: 12 }}>
            <div style={{ flex: 1, border: '1px solid #000', padding: 8 }}>
              <h4 style={{ margin: '0 0 6px 0', borderBottom: '1px solid #000' }}>Consignor Details</h4>
              <p><strong>Name:</strong> {selectedGc.consignor?.name}</p>
              <p><strong>GSTN:</strong> {selectedGc.consignor?.gstn}</p>
              <p><strong>Contact:</strong> {selectedGc.consignor?.mobile}</p>
            </div>
            <div style={{ flex: 1, border: '1px solid #000', padding: 8 }}>
              <h4 style={{ margin: '0 0 6px 0', borderBottom: '1px solid #000' }}>Consignee Details</h4>
              <p><strong>Name:</strong> {selectedGc.consignee?.name}</p>
              <p><strong>GSTN:</strong> {selectedGc.consignee?.gstn}</p>
              <p><strong>Contact:</strong> {selectedGc.consignee?.mobile}</p>
            </div>
          </div>

          <table style={{ margin: '12px 0' }}>
            <thead>
              <tr>
                <th>Said to Contain</th>
                <th>Weight</th>
                <th>Rate/Kg</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{selectedGc.quantity} PKGS OF {selectedGc.saidToContainDesc}</td>
                <td>{selectedGc.charWt} kg</td>
                <td>₹{selectedGc.rateKg}</td>
                <td style={{ textAlign: 'right' }}>₹{selectedGc.freight.toFixed(2)}</td>
              </tr>
              <tr style={{ borderTop: '1px solid #000' }}>
                <td colSpan="3" style={{ textAlign: 'right' }}>Hamali:</td>
                <td style={{ textAlign: 'right' }}>₹{selectedGc.hamali.toFixed(2)}</td>
              </tr>
              <tr>
                <td colSpan="3" style={{ textAlign: 'right' }}>St. Charges:</td>
                <td style={{ textAlign: 'right' }}>₹{selectedGc.stCharges.toFixed(2)}</td>
              </tr>
              <tr>
                <td colSpan="3" style={{ textAlign: 'right' }}>Others:</td>
                <td style={{ textAlign: 'right' }}>₹{selectedGc.others.toFixed(2)}</td>
              </tr>
              <tr>
                <td colSpan="3" style={{ textAlign: 'right' }}>Service Tax ({selectedGc.serviceTaxPercent}%):</td>
                <td style={{ textAlign: 'right' }}>₹{selectedGc.serviceTax.toFixed(2)}</td>
              </tr>
              <tr className="total-row" style={{ fontWeight: 'bold' }}>
                <td colSpan="3" style={{ textAlign: 'right' }}>GRAND TOTAL (Freight + Value + Charges):</td>
                <td style={{ textAlign: 'right' }}>₹{selectedGc.total.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 40, fontSize: 12 }}>
            <div>
              <p>Service Tax Payable by: <strong>{selectedGc.serviceTaxPayableBy}</strong></p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ borderTop: '1px solid #000', width: 200, textAlign: 'center', paddingTop: 4 }}>For DEV ROAD LINES</p>
            </div>
          </div>
        </div>
      </div>
    )}
  </>
)
}

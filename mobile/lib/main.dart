import 'dart:convert';
import 'dart:math';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:sqflite/sqflite.dart';
import 'package:path/path.dart' as path_helper;

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const LogisticsApp());
}

class LogisticsApp extends StatelessWidget {
  const LogisticsApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Sivakasi Logistics',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF4F46E5),
          primary: const Color(0xFF4F46E5),
          secondary: const Color(0xFFF97316),
          brightness: Brightness.light,
        ),
      ),
      darkTheme: ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF6366F1),
          primary: const Color(0xFF6366F1),
          secondary: const Color(0xFFFB923C),
          brightness: Brightness.dark,
        ),
      ),
      themeMode: ThemeMode.system,
      home: const AuthScreen(),
    );
  }
}

// SQLite Offline DB Helper with Upgraded Models (Requirement 11)
class DbHelper {
  static Database? _db;

  static Future<Database> get database async {
    if (_db != null) return _db!;
    _db = await _initDb();
    return _db!;
  }

  static Future<Database> _initDb() async {
    final dbPath = await getDatabasesPath();
    final location = path_helper.join(dbPath, 'sivakasi_logistics_v2.db');
    return await openDatabase(
      location,
      version: 1,
      onCreate: (db, version) async {
        // Consignor Master Cache
        await db.execute('''
          CREATE TABLE consignors(
            id TEXT PRIMARY KEY,
            name TEXT,
            origin TEXT,
            gstn TEXT,
            mobile TEXT
          )
        ''');

        // Consignee Master Cache
        await db.execute('''
          CREATE TABLE consignees(
            id TEXT PRIMARY KEY,
            name TEXT,
            destination TEXT,
            gstn TEXT,
            mobile TEXT
          )
        ''');

        // Lorry Master Cache
        await db.execute('''
          CREATE TABLE lorries(
            id TEXT PRIMARY KEY,
            lorryNumber TEXT,
            lorryName TEXT,
            ownerName TEXT,
            ownerContact TEXT,
            driverName TEXT,
            driverContact TEXT,
            drivingLicenseNumber TEXT
          )
        ''');

        // Goods Consignments (GC / LR) (Requirement 1 & 3)
        await db.execute('''
          CREATE TABLE goods_consignments(
            id TEXT PRIMARY KEY,
            gcNumber TEXT,
            date TEXT,
            consignorId TEXT,
            consigneeId TEXT,
            fromCity TEXT,
            toCity TEXT,
            invoiceNo TEXT,
            invoiceDate TEXT,
            value REAL,
            mark TEXT,
            godown TEXT,
            delivery TEXT,
            hamali REAL,
            stCharges REAL,
            others REAL,
            charWt REAL,
            rateKg REAL,
            freight REAL,
            serviceTaxPercent REAL,
            serviceTax REAL,
            total REAL,
            paymentStatus TEXT,
            quantity INTEGER,
            saidToContainCode TEXT,
            saidToContainDesc TEXT,
            remarks TEXT,
            printType TEXT,
            serviceTaxPayableBy TEXT,
            approvalStatus TEXT,
            enteredById TEXT,
            enteredByName TEXT,
            isSynced INTEGER DEFAULT 0
          )
        ''');

        // Goods Dispatch Memo (GDM) (Requirement 2 & 4)
        await db.execute('''
          CREATE TABLE gdm(
            id TEXT PRIMARY KEY,
            gdmNumber TEXT,
            gdmDate TEXT,
            fromCity TEXT,
            toCity TEXT,
            lorryId TEXT,
            remarks TEXT,
            totalQty INTEGER,
            totalDesp INTEGER,
            totalServiceTax REAL,
            approvalStatus TEXT,
            enteredById TEXT,
            enteredByName TEXT,
            deliveryStatus TEXT,
            isSynced INTEGER DEFAULT 0
          )
        ''');

        // GDMItems Junction Cache
        await db.execute('''
          CREATE TABLE gdm_items(
            id TEXT PRIMARY KEY,
            gdmId TEXT,
            goodsConsignmentId TEXT,
            qty INTEGER,
            desp INTEGER,
            serviceTax REAL
          )
        ''');
      },
    );
  }
}

// Authentication & Self Registration Screen (Requirement 6 & 9)
class AuthScreen extends StatefulWidget {
  const AuthScreen({super.key});

  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> {
  bool _isLoginMode = true; // Toggle between Login and Register

  // Controllers
  final _serverIpController = TextEditingController(text: '192.168.1.100:5000');
  final _loginIdController = TextEditingController(text: 'ADM01');
  final _passwordController = TextEditingController(text: 'Demo@123456');

  // Register Fields
  final _regEmailController = TextEditingController();
  final _regPhoneController = TextEditingController();
  final _regFirstNameController = TextEditingController();
  final _regLastNameController = TextEditingController();
  final _regLoginIdController = TextEditingController();
  final _regPasswordController = TextEditingController();
  String _regRole = 'staff';

  String _selectedRole = 'admin';
  bool _isLoading = false;
  String _errorMessage = '';
  String _successMessage = '';

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: 64,
                height: 64,
                decoration: BoxDecoration(
                  gradient: const LinearGradient(colors: [Color(0xFFF97316), Color(0xFF4F46E5)]),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: const Icon(Icons.local_shipping, size: 36, color: Colors.white),
              ),
              const SizedBox(height: 12),
              Text(
                'DEV ROAD LINES',
                style: theme.textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.bold),
              ),
              Text(
                'Cargo Dispatch Control Desk',
                style: theme.textTheme.bodyMedium?.copyWith(color: theme.colorScheme.onSurfaceVariant),
              ),
              const SizedBox(height: 16),
              if (_errorMessage.isNotEmpty) ...[
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(color: theme.colorScheme.errorContainer, borderRadius: BorderRadius.circular(8)),
                  child: Text(_errorMessage, style: TextStyle(color: theme.colorScheme.onErrorContainer), textAlign: TextAlign.center),
                ),
                const SizedBox(height: 16),
              ],
              if (_successMessage.isNotEmpty) ...[
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(color: Colors.green.shade100, borderRadius: BorderRadius.circular(8)),
                  child: Text(_successMessage, style: TextStyle(color: Colors.green.shade900), textAlign: TextAlign.center),
                ),
                const SizedBox(height: 16),
              ],
              _isLoginMode ? _buildLoginForm() : _buildRegisterForm(),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildLoginForm() {
    final theme = Theme.of(context);
    return Column(
      children: [
        Card(
          elevation: 2,
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: [
                DropdownButtonFormField<String>(
                  value: _selectedRole,
                  decoration: const InputDecoration(labelText: 'Portal Role'),
                  items: const [
                    DropdownMenuItem(value: 'admin', child: Text('Admin Control')),
                    DropdownMenuItem(value: 'staff', child: Text('Staff Operations')),
                    DropdownMenuItem(value: 'customer', child: Text('Customer Access')),
                  ],
                  onChanged: (val) {
                    setState(() {
                      _selectedRole = val!;
                      _loginIdController.text = val == 'admin' ? 'ADM01' : val == 'staff' ? 'STF01' : 'CST01';
                    });
                  },
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _serverIpController,
                  decoration: const InputDecoration(labelText: 'Server LAN Address', prefixIcon: Icon(Icons.wifi)),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _loginIdController,
                  decoration: const InputDecoration(labelText: 'Login ID', prefixIcon: Icon(Icons.person)),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _passwordController,
                  obscureText: true,
                  decoration: const InputDecoration(labelText: 'Password', prefixIcon: Icon(Icons.lock)),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 20),
        ElevatedButton(
          onPressed: _isLoading ? null : () => _login(false),
          style: ElevatedButton.styleFrom(
            backgroundColor: theme.colorScheme.primary,
            foregroundColor: theme.colorScheme.onPrimary,
            minimumSize: const Size.fromHeight(50),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          ),
          child: _isLoading ? const CircularProgressIndicator(color: Colors.white) : const Text('Sign In to System', style: TextStyle(fontWeight: FontWeight.bold)),
        ),
        const SizedBox(height: 12),
        OutlinedButton(
          onPressed: _isLoading ? null : () => _login(true),
          style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(50), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
          child: const Text('Continue with Google'),
        ),
        const SizedBox(height: 16),
        TextButton(
          onPressed: () => setState(() => _isLoginMode = false),
          child: const Text('New user? Register Staff/Customer Account'),
        )
      ],
    );
  }

  Widget _buildRegisterForm() {
    final theme = Theme.of(context);
    return Column(
      children: [
        Card(
          elevation: 2,
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: [
                DropdownButtonFormField<String>(
                  value: _regRole,
                  decoration: const InputDecoration(labelText: 'Register Role'),
                  items: const [
                    DropdownMenuItem(value: 'staff', child: Text('Staff Desk')),
                    DropdownMenuItem(value: 'customer', child: Text('Customer')),
                  ],
                  onChanged: (val) => setState(() => _regRole = val!),
                ),
                const SizedBox(height: 8),
                TextField(controller: _regLoginIdController, decoration: const InputDecoration(labelText: 'Desired Login ID')),
                const SizedBox(height: 8),
                TextField(controller: _regEmailController, decoration: const InputDecoration(labelText: 'Email Address')),
                const SizedBox(height: 8),
                TextField(controller: _regPhoneController, decoration: const InputDecoration(labelText: 'Phone Number')),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Expanded(child: TextField(controller: _regFirstNameController, decoration: const InputDecoration(labelText: 'First Name'))),
                    const SizedBox(width: 8),
                    Expanded(child: TextField(controller: _regLastNameController, decoration: const InputDecoration(labelText: 'Last Name'))),
                  ],
                ),
                const SizedBox(height: 8),
                TextField(controller: _regPasswordController, obscureText: true, decoration: const InputDecoration(labelText: 'Choose Password')),
              ],
            ),
          ),
        ),
        const SizedBox(height: 16),
        ElevatedButton(
          onPressed: _isLoading ? null : _register,
          style: ElevatedButton.styleFrom(
            backgroundColor: theme.colorScheme.secondary,
            foregroundColor: Colors.white,
            minimumSize: const Size.fromHeight(50),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          ),
          child: const Text('Submit Registration', style: TextStyle(fontWeight: FontWeight.bold)),
        ),
        const SizedBox(height: 12),
        TextButton(
          onPressed: () => setState(() => _isLoginMode = true),
          child: const Text('Return to Login'),
        )
      ],
    );
  }

  Future<void> _login(bool isGoogle) async {
    setState(() {
      _isLoading = true;
      _errorMessage = '';
      _successMessage = '';
    });

    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('serverIp', _serverIpController.text.trim());

    if (isGoogle) {
      // Mock Google OAuth
      await prefs.setString('token', 'mock-google-token');
      await prefs.setString('role', _selectedRole);
      await prefs.setString('loginId', _selectedRole == 'admin' ? 'ADM01' : _selectedRole == 'staff' ? 'STF01' : 'CST01');
      await prefs.setString('userName', 'Google User');
      await prefs.setBool('isDefaultPassword', false);
      _goToDashboard();
    } else {
      try {
        final serverIp = _serverIpController.text.trim();
        final response = await http.post(
          Uri.parse('http://$serverIp/v1/auth/login'),
          headers: {'Content-Type': 'application/json'},
          body: jsonEncode({
            'loginId': _loginIdController.text.trim(),
            'password': _passwordController.text.trim()
          }),
        ).timeout(const Duration(seconds: 4));

        final data = jsonDecode(response.body);
        if (response.statusCode == 200) {
          await prefs.setString('token', data['accessToken']);
          await prefs.setString('role', data['user']['role']);
          await prefs.setString('loginId', data['user']['loginId'] ?? '');
          await prefs.setString('userName', '${data['user']['firstName']} ${data['user']['lastName']}');
          await prefs.setString('staffPermission', data['user']['staffPermission'] ?? 'EDIT');
          await prefs.setBool('isDefaultPassword', data['user']['isDefaultPassword'] ?? false);
          _goToDashboard();
        } else {
          setState(() {
            _errorMessage = data['message'] ?? 'Login failed';
          });
        }
      } catch (e) {
        // Offline seed bypass
        final id = _loginIdController.text.trim();
        if ((id == 'ADM01' || id == 'STF01' || id == 'CST01') && _passwordController.text == 'Demo@123456') {
          await prefs.setString('token', 'mock-offline-token');
          await prefs.setString('role', id == 'ADM01' ? 'admin' : id == 'STF01' ? 'staff' : 'customer');
          await prefs.setString('loginId', id);
          await prefs.setString('userName', id == 'ADM01' ? 'Admin offline' : id == 'STF01' ? 'Staff offline' : 'Customer offline');
          await prefs.setString('staffPermission', 'EDIT');
          await prefs.setBool('isDefaultPassword', false);
          _goToDashboard();
        } else {
          setState(() {
            _errorMessage = 'Connection failed. Use pre-seeded login ID (e.g. ADM01) and password for offline access.';
          });
        }
      }
    }

    setState(() {
      _isLoading = false;
    });
  }

  Future<void> _register() async {
    setState(() {
      _isLoading = true;
      _errorMessage = '';
      _successMessage = '';
    });

    try {
      final serverIp = _serverIpController.text.trim();
      final response = await http.post(
        Uri.parse('http://$serverIp/v1/auth/register'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'loginId': _regLoginIdController.text.trim(),
          'email': _regEmailController.text.trim(),
          'phone': _regPhoneController.text.trim(),
          'firstName': _regFirstNameController.text.trim(),
          'lastName': _regLastNameController.text.trim(),
          'role': _regRole,
          'password': _regPasswordController.text
        }),
      ).timeout(const Duration(seconds: 4));

      final data = jsonDecode(response.body);
      if (response.statusCode == 201) {
        setState(() {
          _successMessage = data['message'] ?? 'Registration submitted! Waiting for Admin approval.';
          _isLoginMode = true;
        });
      } else {
        setState(() {
          _errorMessage = data['message'] ?? 'Registration failed';
        });
      }
    } catch (e) {
      setState(() {
        _errorMessage = 'Cannot submit registration: server offline';
      });
    }

    setState(() {
      _isLoading = false;
    });
  }

  void _goToDashboard() {
    Navigator.of(context).pushReplacement(MaterialPageRoute(builder: (_) => const MainTabsScreen()));
  }
}

// Tab screens navigator
class MainTabsScreen extends StatefulWidget {
  const MainTabsScreen({super.key});

  @override
  State<MainTabsScreen> createState() => _MainTabsScreenState();
}

class _MainTabsScreenState extends State<MainTabsScreen> {
  int _currentIndex = 0;
  String _userRole = 'customer';

  final List<Widget> _adminScreens = [
    const DashboardScreen(),
    const MastersScreen(),
    const GcDataEntryScreen(), // Consolidated GC entry sheet (Requirement 1)
    const GdmEntryScreen(), // Consolidated GDM loading sheet (Requirement 4)
    const SyncScreen(),
  ];

  final List<Widget> _customerScreens = [
    const DashboardScreen(),
    const SyncScreen(),
  ];

  @override
  void initState() {
    super.initState();
    _loadRole();
    _checkPasswordLock();
  }

  Future<void> _loadRole() async {
    final prefs = await SharedPreferences.getInstance();
    setState(() {
      _userRole = prefs.getString('role') ?? 'customer';
    });
  }

  // Force first-time password reset (Requirement 9)
  Future<void> _checkPasswordLock() async {
    final prefs = await SharedPreferences.getInstance();
    final isLock = prefs.getBool('isDefaultPassword') ?? false;
    if (isLock) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        _showPasswordResetDialog();
      });
    }
  }

  void _showPasswordResetDialog() {
    final oldController = TextEditingController(text: 'Demo@123456');
    final newController = TextEditingController();
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) {
        return AlertDialog(
          title: const Text('Update Password Required', style: TextStyle(color: Colors.red)),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text('You are logged in with a default password. Please choose a new secure password to continue.'),
              const SizedBox(height: 12),
              TextField(controller: oldController, obscureText: true, decoration: const InputDecoration(labelText: 'Current Password')),
              const SizedBox(height: 12),
              TextField(controller: newController, obscureText: true, decoration: const InputDecoration(labelText: 'New Password')),
            ],
          ),
          actions: [
            ElevatedButton(
              onPressed: () async {
                if (newController.text.length < 6) return;
                final prefs = await SharedPreferences.getInstance();
                final ip = prefs.getString('serverIp') ?? '';
                final token = prefs.getString('token') ?? '';
                try {
                  final res = await http.post(
                    Uri.parse('http://$ip/v1/auth/change-password'),
                    headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer $token'},
                    body: jsonEncode({'oldPassword': oldController.text, 'newPassword': newController.text.trim()})
                  );
                  if (res.statusCode == 200) {
                    await prefs.setBool('isDefaultPassword', false);
                    Navigator.of(ctx).pop();
                    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Password updated successfully!')));
                  }
                } catch (_) {
                  ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Server unreachable. Cannot reset password.')));
                }
              },
              child: const Text('Update Password'),
            )
          ],
        );
      }
    );
  }

  @override
  Widget build(BuildContext context) {
    final isAdminOrStaff = _userRole == 'admin' || _userRole == 'staff';
    final activeScreens = isAdminOrStaff ? _adminScreens : _customerScreens;

    final adminItems = const [
      NavigationDestination(icon: Icon(Icons.dashboard), label: 'Status'),
      NavigationDestination(icon: Icon(Icons.storage), label: 'Masters'),
      NavigationDestination(icon: Icon(Icons.note_add), label: 'GC Entry'),
      NavigationDestination(icon: Icon(Icons.local_shipping), label: 'GDM Loading'),
      NavigationDestination(icon: Icon(Icons.sync), label: 'Sync'),
    ];

    final customerItems = const [
      NavigationDestination(icon: Icon(Icons.dashboard), label: 'Dashboard'),
      NavigationDestination(icon: Icon(Icons.sync), label: 'Cargo Tracker'),
    ];

    return Scaffold(
      body: IndexedStack(index: _currentIndex, children: activeScreens),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _currentIndex,
        onDestinationSelected: (idx) => setState(() => _currentIndex = idx),
        destinations: isAdminOrStaff ? adminItems : customerItems,
      ),
    );
  }
}

// 1. Dashboard Screen (Role-specific customer timelines)
class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  int _activeDispatches = 0;
  double _freightPool = 0.0;
  List<Map<String, dynamic>> _myConsignments = [];
  String _userRole = 'customer';

  @override
  void initState() {
    super.initState();
    _loadStats();
  }

  Future<void> _loadStats() async {
    final prefs = await SharedPreferences.getInstance();
    final role = prefs.getString('role') ?? 'customer';
    final db = await DbHelper.database;

    final List<Map<String, dynamic>> gdmList = await db.query('gdm');
    int active = 0;
    double freight = 0.0;

    for (var m in gdmList) {
      if (m['deliveryStatus'] != 'delivered') active++;
      freight += (m['totalServiceTax'] as num? ?? 0.0).toDouble();
    }

    final gcs = await db.query('goods_consignments', orderBy: 'date DESC');

    setState(() {
      _userRole = role;
      _activeDispatches = active;
      _freightPool = freight;
      _myConsignments = gcs;
    });
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isClient = _userRole == 'customer';

    return Scaffold(
      appBar: AppBar(
        title: const Text('Logistics Desk'),
        actions: [IconButton(onPressed: _loadStats, icon: const Icon(Icons.refresh))],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (isClient) ...[
            Text('My Registered Cargo Timeline', style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
            const SizedBox(height: 10),
            ..._myConsignments.map((c) => _buildCustomerCargoCard(c)),
            if (_myConsignments.isEmpty)
              const Center(child: Padding(padding: EdgeInsets.all(32), child: Text('No shipments found. Sync with server.', style: TextStyle(color: Colors.grey)))),
          ] else ...[
            Card(
              color: theme.colorScheme.primaryContainer,
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Active Server Dashboard', style: TextStyle(color: theme.colorScheme.onPrimaryContainer, fontWeight: FontWeight.bold)),
                    const SizedBox(height: 12),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text('Lorry Dispatches in Transit: $_activeDispatches', style: theme.textTheme.bodyMedium),
                        Text('Service Tax Accrued: ₹${_freightPool.toStringAsFixed(2)}', style: theme.textTheme.bodyMedium),
                      ],
                    )
                  ],
                ),
              ),
            )
          ]
        ],
      ),
    );
  }

  Widget _buildCustomerCargoCard(Map<String, dynamic> gc) {
    final status = gc['approvalStatus'] ?? 'PENDING';
    return Card(
      child: ExpansionTile(
        title: Text('${gc['gcNumber']} ➡️ ${gc['toCity']}'),
        subtitle: Text('Packages: ${gc['quantity']} | Total Billing: ₹${gc['total']}'),
        leading: Icon(Icons.inventory_2, color: status == 'APPROVED' ? Colors.green : Colors.orange),
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Invoice: ${gc['invoiceNo']}'),
                Text('Said to Contain: ${gc['saidToContainDesc']}'),
                Text('Payment: ${gc['paymentStatus']}'),
                Text('Remarks: ${gc['remarks'] ?? 'None'}'),
                const Divider(),
                const Text('Lorry Dispatch Details:', style: TextStyle(fontWeight: FontWeight.bold)),
                // Render mock dispatch tracker
                const ListTile(
                  leading: Icon(Icons.local_shipping),
                  title: Text('Lorry: TN-67-X-9988'),
                  subtitle: Text('Driver: Muthu Kumar (9845654321)'),
                  trailing: Text('IN TRANSIT', style: TextStyle(color: Colors.blue, fontWeight: FontWeight.bold)),
                )
              ],
            ),
          )
        ],
      ),
    );
  }
}

// 2. Masters list view
class MastersScreen extends StatefulWidget {
  const MastersScreen({super.key});

  @override
  State<MastersScreen> createState() => _MastersScreenState();
}

class _MastersScreenState extends State<MastersScreen> with SingleTickerProviderStateMixin {
  TabController? _tabController;
  List<Map<String, dynamic>> _consignors = [];
  List<Map<String, dynamic>> _consignees = [];
  List<Map<String, dynamic>> _lorries = [];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    _loadMasters();
  }

  Future<void> _loadMasters() async {
    final db = await DbHelper.database;
    final cr = await db.query('consignors', orderBy: 'name ASC');
    final ce = await db.query('consignees', orderBy: 'name ASC');
    final lr = await db.query('lorries', orderBy: 'lorryNumber ASC');
    setState(() {
      _consignors = cr;
      _consignees = ce;
      _lorries = lr;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Master Data Sheets'),
        bottom: TabBar(
          controller: _tabController,
          tabs: const [Tab(text: 'Consignors'), Tab(text: 'Consignees'), Tab(text: 'Lorries')],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          _buildList(_consignors, 'consignor'),
          _buildList(_consignees, 'consignee'),
          _buildList(_lorries, 'lorry'),
        ],
      ),
    );
  }

  Widget _buildList(List<Map<String, dynamic>> list, String type) {
    return ListView.builder(
      itemCount: list.length,
      padding: const EdgeInsets.all(8),
      itemBuilder: (context, idx) {
        final it = list[idx];
        if (type == 'lorry') {
          return Card(
            child: ListTile(
              leading: const Icon(Icons.local_shipping),
              title: Text('${it['lorryNumber']} [${it['lorryName']}]'),
              subtitle: Text('Owner: ${it['ownerName']}\nDriver: ${it['driverName']} (${it['driverContact']})'),
            ),
          );
        } else {
          return Card(
            child: ListTile(
              leading: const Icon(Icons.business),
              title: Text(it['name']),
              subtitle: Text('GSTN: ${it['gstn']} | Location: ${it[type == 'consignor' ? 'origin' : 'destination']}'),
            ),
          );
        }
      },
    );
  }
}

// 3. Consignment Data Entry Screen (Screenshot 1 format calculations) (Requirement 1)
class GcDataEntryScreen extends StatefulWidget {
  const GcDataEntryScreen({super.key});

  @override
  State<GcDataEntryScreen> createState() => _GcDataEntryScreenState();
}

class _GcDataEntryScreenState extends State<GcDataEntryScreen> {
  final _invoiceNoController = TextEditingController();
  final _valueController = TextEditingController(text: '0');
  final _markController = TextEditingController();
  final _godownController = TextEditingController();
  final _deliveryController = TextEditingController();
  final _hamaliController = TextEditingController(text: '0');
  final _stChargesController = TextEditingController(text: '0');
  final _othersController = TextEditingController(text: '0');
  final _charWtController = TextEditingController(text: '0');
  final _rateKgController = TextEditingController(text: '0');
  final _serviceTaxPercentController = TextEditingController(text: '5');
  final _quantityController = TextEditingController(text: '0');
  final _remarksController = TextEditingController();

  String? _selectedConsignor;
  String? _selectedConsignee;
  String _paymentStatus = 'To/Pay';
  String _saidToContainCode = '1';
  String _serviceTaxPayableBy = 'Consignee';

  List<Map<String, dynamic>> _consignors = [];
  List<Map<String, dynamic>> _consignees = [];

  // Live calculation results
  double _freight = 0.0;
  double _serviceTax = 0.0;
  double _total = 0.0;

  @override
  void initState() {
    super.initState();
    _loadMasters();
    _setupCalculationsListeners();
  }

  Future<void> _loadMasters() async {
    final db = await DbHelper.database;
    final cr = await db.query('consignors', orderBy: 'name ASC');
    final ce = await db.query('consignees', orderBy: 'name ASC');
    setState(() {
      _consignors = cr;
      _consignees = ce;
    });
  }

  void _setupCalculationsListeners() {
    void recalc() {
      final wt = double.tryParse(_charWtController.text) ?? 0.0;
      final rate = double.tryParse(_rateKgController.text) ?? 0.0;
      final val = double.tryParse(_valueController.text) ?? 0.0;
      final ham = double.tryParse(_hamaliController.text) ?? 0.0;
      final st = double.tryParse(_stChargesController.text) ?? 0.0;
      final oth = double.tryParse(_othersController.text) ?? 0.0;
      final taxPercent = double.tryParse(_serviceTaxPercentController.text) ?? 5.0;

      final freight = wt * rate;
      final tax = freight * (taxPercent / 100);
      final total = val + freight + tax + ham + st + oth; // Value + Freight + ST + Hamali + StCharges + Others

      setState(() {
        _freight = freight;
        _serviceTax = tax;
        _total = total;
      });
    }

    _charWtController.addListener(recalc);
    _rateKgController.addListener(recalc);
    _valueController.addListener(recalc);
    _hamaliController.addListener(recalc);
    _stChargesController.addListener(recalc);
    _othersController.addListener(recalc);
    _serviceTaxPercentController.addListener(recalc);
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(title: const Text('Consignment Data Entry Note')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            DropdownButtonFormField<String>(
              value: _selectedConsignor,
              decoration: const InputDecoration(labelText: 'Consignor (Seller)'),
              items: _consignors.map((c) => DropdownMenuItem<String>(value: c['id']?.toString() ?? '', child: Text(c['name']?.toString() ?? ''))).toList(),
              onChanged: (val) => setState(() => _selectedConsignor = val),
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              value: _selectedConsignee,
              decoration: const InputDecoration(labelText: 'Consignee (Buyer)'),
              items: _consignees.map((c) => DropdownMenuItem<String>(value: c['id']?.toString() ?? '', child: Text(c['name']?.toString() ?? ''))).toList(),
              onChanged: (val) => setState(() => _selectedConsignee = val),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(child: TextField(controller: _invoiceNoController, decoration: const InputDecoration(labelText: 'Invoice No'))),
                const SizedBox(width: 12),
                Expanded(child: TextField(controller: _valueController, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Cargo Value (₹)'))),
              ],
            ),
            Row(
              children: [
                Expanded(child: TextField(controller: _markController, decoration: const InputDecoration(labelText: 'Mark'))),
                const SizedBox(width: 12),
                Expanded(child: TextField(controller: _godownController, decoration: const InputDecoration(labelText: 'Godown'))),
              ],
            ),
            Row(
              children: [
                Expanded(child: TextField(controller: _deliveryController, decoration: const InputDecoration(labelText: 'Delivery Method'))),
                const SizedBox(width: 12),
                Expanded(child: TextField(controller: _quantityController, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Package Quantity'))),
              ],
            ),
            Row(
              children: [
                Expanded(child: TextField(controller: _hamaliController, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Hamali'))),
                const SizedBox(width: 8),
                Expanded(child: TextField(controller: _stChargesController, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'St. Charges'))),
                const SizedBox(width: 8),
                Expanded(child: TextField(controller: _othersController, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Others'))),
              ],
            ),
            Row(
              children: [
                Expanded(child: TextField(controller: _charWtController, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Char Wt'))),
                const SizedBox(width: 12),
                Expanded(child: TextField(controller: _rateKgController, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Rate/Kg'))),
              ],
            ),
            Row(
              children: [
                Expanded(child: Text('Freight: ₹${_freight.toStringAsFixed(2)}', style: const TextStyle(fontWeight: FontWeight.bold))),
                Expanded(child: TextField(controller: _serviceTaxPercentController, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'ST %'))),
                Expanded(child: Text('Tax: ₹${_serviceTax.toStringAsFixed(2)}', style: const TextStyle(fontWeight: FontWeight.bold))),
              ],
            ),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(12),
              color: theme.colorScheme.primaryContainer,
              child: Text(
                'Total Billing: ₹${_total.toStringAsFixed(2)}',
                style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold, color: theme.colorScheme.onPrimaryContainer),
              ),
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              value: _saidToContainCode,
              decoration: const InputDecoration(labelText: 'Said to Contain Code'),
              items: const [
                DropdownMenuItem(value: '1', child: Text('1 = FWs (Fireworks)')),
                DropdownMenuItem(value: '2', child: Text('2 = Caps')),
                DropdownMenuItem(value: '3', child: Text('3 = PGoods')),
                DropdownMenuItem(value: '4', child: Text('4 = Smatches')),
                DropdownMenuItem(value: '5', child: Text('5 = Others')),
              ],
              onChanged: (val) => setState(() => _saidToContainCode = val!),
            ),
            DropdownButtonFormField<String>(
              value: _paymentStatus,
              decoration: const InputDecoration(labelText: 'Payment Status'),
              items: const [
                DropdownMenuItem(value: 'To/Pay', child: Text('To/Pay')),
                DropdownMenuItem(value: 'Paid', child: Text('Paid')),
                DropdownMenuItem(value: 'TBB', child: Text('TBB (To Be Billed)')),
              ],
              onChanged: (val) => setState(() => _paymentStatus = val!),
            ),
            DropdownButtonFormField<String>(
              value: _serviceTaxPayableBy,
              decoration: const InputDecoration(labelText: 'Service Tax Payable By'),
              items: const [
                DropdownMenuItem(value: 'Consignee', child: Text('Consignee')),
                DropdownMenuItem(value: 'Consignor', child: Text('Consignor')),
                DropdownMenuItem(value: 'Transporter', child: Text('Transporter')),
              ],
              onChanged: (val) => setState(() => _serviceTaxPayableBy = val!),
            ),
            const SizedBox(height: 12),
            TextField(controller: _remarksController, decoration: const InputDecoration(labelText: 'Remarks')),
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: _saveGc,
              style: ElevatedButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 14)),
              child: const Text('Save Cargo Consignment Offline', style: TextStyle(fontWeight: FontWeight.bold)),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _saveGc() async {
    if (_selectedConsignor == null || _selectedConsignee == null) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Please select Consignor & Consignee')));
      return;
    }

    final db = await DbHelper.database;
    final id = DateTime.now().millisecondsSinceEpoch.toString();
    final gcNumber = 'D${Random().nextInt(90000) + 10000}';

    String desc = 'OTHERS';
    if (_saidToContainCode == '1') desc = 'FIREWORKS';
    if (_saidToContainCode == '2') desc = 'CAPS';
    if (_saidToContainCode == '3') desc = 'PRINTED GOODS';
    if (_saidToContainCode == '4') desc = 'SAFETY MATCHES';

    final prefs = await SharedPreferences.getInstance();
    final role = prefs.getString('role') ?? 'staff';
    final permission = prefs.getString('staffPermission') ?? 'EDIT';

    // Verify view-only staff
    if (role == 'staff' && permission == 'ENTER_VIEW') {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Error: View/Enter Only staff cannot create or edit records.')));
      return;
    }

    final approvalStatus = role == 'admin' ? 'APPROVED' : 'PENDING_APPROVAL';

    await db.insert('goods_consignments', {
      'id': id,
      'gcNumber': gcNumber,
      'date': DateTime.now().toIso8601String().split('T')[0],
      'consignorId': _selectedConsignor,
      'consigneeId': _selectedConsignee,
      'fromCity': 'SIVAKASI',
      'toCity': 'DELHI',
      'invoiceNo': _invoiceNoController.text,
      'value': double.tryParse(_valueController.text) ?? 0.0,
      'mark': _markController.text,
      'godown': _godownController.text,
      'delivery': _deliveryController.text,
      'hamali': double.tryParse(_hamaliController.text) ?? 0.0,
      'stCharges': double.tryParse(_stChargesController.text) ?? 0.0,
      'others': double.tryParse(_othersController.text) ?? 0.0,
      'charWt': double.tryParse(_charWtController.text) ?? 0.0,
      'rateKg': double.tryParse(_rateKgController.text) ?? 0.0,
      'freight': _freight,
      'serviceTaxPercent': double.tryParse(_serviceTaxPercentController.text) ?? 5.0,
      'serviceTax': _serviceTax,
      'total': _total,
      'paymentStatus': _paymentStatus,
      'quantity': int.tryParse(_quantityController.text) ?? 0,
      'saidToContainCode': _saidToContainCode,
      'saidToContainDesc': desc,
      'remarks': _remarksController.text,
      'printType': 'LORRY COPY',
      'serviceTaxPayableBy': _serviceTaxPayableBy,
      'approvalStatus': approvalStatus,
      'enteredById': prefs.getString('loginId'),
      'enteredByName': prefs.getString('userName'),
      'isSynced': 0,
    });

    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Created GC Consignment: $gcNumber offline')));
    Navigator.of(context).pushReplacement(MaterialPageRoute(builder: (_) => const MainTabsScreen()));
  }
}

// 4. GDM loading Form (Requirement 4)
class GdmEntryScreen extends StatefulWidget {
  const GdmEntryScreen({super.key});

  @override
  State<GdmEntryScreen> createState() => _GdmEntryScreenState();
}

class _GdmEntryScreenState extends State<GdmEntryScreen> {
  final _remarksController = TextEditingController();
  String? _selectedLorry;
  List<Map<String, dynamic>> _lorries = [];
  List<Map<String, dynamic>> _pendingGcs = [];
  
  // Selected loads list
  final List<Map<String, dynamic>> _loadedItems = [];

  @override
  void initState() {
    super.initState();
    _loadLists();
  }

  Future<void> _loadLists() async {
    final db = await DbHelper.database;
    final lr = await db.query('lorries', orderBy: 'lorryNumber ASC');
    // Load approved GCs only
    final gcs = await db.query('goods_consignments', where: 'approvalStatus = ?', whereArgs: ['APPROVED']);
    setState(() {
      _lorries = lr;
      _pendingGcs = gcs;
    });
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    // Sum calculations
    int totalQty = _loadedItems.fold(0, (sum, item) => sum + (item['qty'] as int));
    int totalDesp = _loadedItems.fold(0, (sum, item) => sum + (item['desp'] as int));
    double totalServiceTax = _loadedItems.fold(0.0, (sum, item) => sum + (item['serviceTax'] as double));

    return Scaffold(
      appBar: AppBar(title: const Text('GDM Loading Form')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            DropdownButtonFormField<String>(
              value: _selectedLorry,
              decoration: const InputDecoration(labelText: 'Select Fleet Lorry'),
              items: _lorries.map((l) => DropdownMenuItem<String>(value: l['id']?.toString() ?? '', child: Text(l['lorryNumber']?.toString() ?? ''))).toList(),
              onChanged: (val) => setState(() => _selectedLorry = val),
            ),
            const SizedBox(height: 12),
            TextField(controller: _remarksController, decoration: const InputDecoration(labelText: 'Remarks')),
            const SizedBox(height: 12),
            
            // Total display card
            Card(
              color: Colors.orange.shade50,
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text('Total Qty: $totalQty', style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.black)),
                    Text('Loaded: $totalDesp', style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.black)),
                    Text('Tax: ₹${totalServiceTax.toStringAsFixed(2)}', style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.black)),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 12),
            const Text('Pick Consignments to Load:', style: TextStyle(fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            Container(
              height: 50,
              child: ListView(
                scrollDirection: Axis.horizontal,
                children: _pendingGcs.where((c) => !_loadedItems.any((item) => item['goodsConsignmentId'] == c['id'])).map((c) {
                  return Padding(
                    padding: const EdgeInsets.only(right: 8.0),
                    child: ActionChip(
                      label: Text('${c['gcNumber']} (${c['quantity']} boxes)'),
                      onPressed: () {
                        setState(() {
                          _loadedItems.add({
                            'goodsConsignmentId': c['id'],
                            'gcNumber': c['gcNumber'],
                            'qty': c['quantity'],
                            'desp': c['quantity'],
                            'serviceTax': c['serviceTax']
                          });
                        });
                      },
                    ),
                  );
                }).toList(),
              ),
            ),
            const SizedBox(height: 16),
            const Text('Loaded Lorry Items Grid:', style: TextStyle(fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            ..._loadedItems.map((item) {
              return Card(
                child: ListTile(
                  title: Text('GC No: ${item['gcNumber']} (Qty: ${item['qty']})'),
                  subtitle: Row(
                    children: [
                      const Text('Load: '),
                      SizedBox(
                        width: 80,
                        height: 30,
                        child: TextField(
                          keyboardType: TextInputType.number,
                          decoration: const InputDecoration(contentPadding: EdgeInsets.symmetric(horizontal: 4)),
                          controller: TextEditingController(text: '${item['desp']}'),
                          onChanged: (val) {
                            final load = int.tryParse(val) ?? 0;
                            setState(() {
                              item['desp'] = load;
                              // proportional service tax
                              item['serviceTax'] = (load / item['qty']) * (item['serviceTax'] as double);
                            });
                          },
                        ),
                      )
                    ],
                  ),
                  trailing: IconButton(
                    icon: const Icon(Icons.delete, color: Colors.red),
                    onPressed: () => setState(() => _loadedItems.remove(item)),
                  ),
                ),
              );
            }).toList(),

            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: _saveGdm,
              child: const Text('Save Dispatch Memo Offline', style: TextStyle(fontWeight: FontWeight.bold)),
            )
          ],
        ),
      ),
    );
  }

  Future<void> _saveGdm() async {
    if (_selectedLorry == null || _loadedItems.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Please configure lorry and load items.')));
      return;
    }

    final db = await DbHelper.database;
    final prefs = await SharedPreferences.getInstance();

    final gdmId = DateTime.now().millisecondsSinceEpoch.toString();
    final gdmNumber = 'D${Random().nextInt(90000) + 10000}';

    int totalQty = _loadedItems.fold(0, (sum, item) => sum + (item['qty'] as int));
    int totalDesp = _loadedItems.fold(0, (sum, item) => sum + (item['desp'] as int));
    double totalServiceTax = _loadedItems.fold(0.0, (sum, item) => sum + (item['serviceTax'] as double));

    final role = prefs.getString('role') ?? 'staff';
    final approvalStatus = role == 'admin' ? 'APPROVED' : 'PENDING_APPROVAL';

    // Insert GDM
    await db.insert('gdm', {
      'id': gdmId,
      'gdmNumber': gdmNumber,
      'gdmDate': DateTime.now().toIso8601String(),
      'fromCity': 'SIVAKASI',
      'toCity': 'DELHI',
      'lorryId': _selectedLorry,
      'remarks': _remarksController.text,
      'totalQty': totalQty,
      'totalDesp': totalDesp,
      'totalServiceTax': totalServiceTax,
      'approvalStatus': approvalStatus,
      'enteredById': prefs.getString('loginId'),
      'enteredByName': prefs.getString('userName'),
      'deliveryStatus': 'pending',
      'isSynced': 0
    });

    // Insert GDM Items
    for (var item in _loadedItems) {
      await db.insert('gdm_items', {
        'id': DateTime.now().millisecondsSinceEpoch.toString() + Random().nextInt(100).toString(),
        'gdmId': gdmId,
        'goodsConsignmentId': item['goodsConsignmentId'],
        'qty': item['qty'],
        'desp': item['desp'],
        'serviceTax': item['serviceTax']
      });
    }

    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Created GDM: $gdmNumber offline')));
    Navigator.of(context).pushReplacement(MaterialPageRoute(builder: (_) => const MainTabsScreen()));
  }
}

// 5. Cloud Synchronization screen
class SyncScreen extends StatefulWidget {
  const SyncScreen({super.key});

  @override
  State<SyncScreen> createState() => _SyncScreenState();
}

class _SyncScreenState extends State<SyncScreen> {
  bool _isSyncing = false;
  String _syncLog = '';

  Future<void> _startSync() async {
    setState(() {
      _isSyncing = true;
      _syncLog = 'Initializing network bridge sync...\n';
    });

    final prefs = await SharedPreferences.getInstance();
    final serverIp = prefs.getString('serverIp') ?? '';
    final token = prefs.getString('token') ?? '';

    if (serverIp.isEmpty || token.isEmpty) {
      setState(() {
        _syncLog += 'Error: server settings missing. Log in online first.\n';
        _isSyncing = false;
      });
      return;
    }

    final db = await DbHelper.database;

    try {
      // 1. Pull down Masters
      _syncLog += 'Downloading master registries from cloud...\n';
      final headers = {'Authorization': 'Bearer $token', 'Content-Type': 'application/json'};

      final crRes = await http.get(Uri.parse('http://$serverIp/v1/master/consignors'), headers: headers);
      if (crRes.statusCode == 200) {
        final List data = jsonDecode(crRes.body)['data'];
        for (var map in data) {
          await db.insert('consignors', {
            'id': map['id'], 'name': map['name'], 'origin': map['origin'], 'gstn': map['gstn'], 'mobile': map['mobile']
          }, conflictAlgorithm: ConflictAlgorithm.replace);
        }
        _syncLog += '✓ Downloaded ${data.length} Consignors\n';
      }

      final ceRes = await http.get(Uri.parse('http://$serverIp/v1/master/consignees'), headers: headers);
      if (ceRes.statusCode == 200) {
        final List data = jsonDecode(ceRes.body)['data'];
        for (var map in data) {
          await db.insert('consignees', {
            'id': map['id'], 'name': map['name'], 'destination': map['destination'], 'gstn': map['gstn'], 'mobile': map['mobile']
          }, conflictAlgorithm: ConflictAlgorithm.replace);
        }
        _syncLog += '✓ Downloaded ${data.length} Consignees\n';
      }

      final lrRes = await http.get(Uri.parse('http://$serverIp/v1/master/lorries'), headers: headers);
      if (lrRes.statusCode == 200) {
        final List data = jsonDecode(lrRes.body)['data'];
        for (var map in data) {
          await db.insert('lorries', {
            'id': map['id'], 'lorryNumber': map['lorryNumber'], 'lorryName': map['lorryName'],
            'ownerName': map['ownerName'], 'ownerContact': map['ownerContact'], 'driverName': map['driverName'],
            'driverContact': map['driverContact'], 'drivingLicenseNumber': map['drivingLicenseNumber']
          }, conflictAlgorithm: ConflictAlgorithm.replace);
        }
        _syncLog += '✓ Downloaded ${data.length} Fleet Vehicles\n';
      }

      // 2. Upload locally saved Goods Consignments
      final List<Map<String, dynamic>> localGcs = await db.query('goods_consignments', where: 'isSynced = ?', whereArgs: [0]);
      _syncLog += 'Found ${localGcs.length} offline Consignments to upload...\n';
      
      for (var gc in localGcs) {
        final Map<String, dynamic> body = Map.from(gc)..remove('isSynced');
        final res = await http.post(
          Uri.parse('http://$serverIp/v1/gc'),
          headers: headers,
          body: jsonEncode(body)
        );
        if (res.statusCode == 201) {
          await db.update('goods_consignments', {'isSynced': 1}, where: 'id = ?', whereArgs: [gc['id']]);
          _syncLog += '✓ Uploaded GC Consignment ${gc['gcNumber']}\n';
        }
      }

      // 3. Upload locally saved GDMs
      final List<Map<String, dynamic>> localGdms = await db.query('gdm', where: 'isSynced = ?', whereArgs: [0]);
      _syncLog += 'Found ${localGdms.length} offline GDMs to upload...\n';

      for (var gdm in localGdms) {
        // Find children items
        final List<Map<String, dynamic>> items = await db.query('gdm_items', where: 'gdmId = ?', whereArgs: [gdm['id']]);
        final itemsList = items.map((it) => {
          'goodsConsignmentId': it['goodsConsignmentId'],
          'desp': it['desp'],
          'serviceTax': it['serviceTax']
        }).toList();

        final Map<String, dynamic> body = Map.from(gdm)
          ..remove('isSynced')
          ..remove('id')
          ..remove('gdmNumber')
          ..remove('gdmDate')
          ..addAll({'items': itemsList});

        final res = await http.post(
          Uri.parse('http://$serverIp/v1/gdm'),
          headers: headers,
          body: jsonEncode(body)
        );

        if (res.statusCode == 201) {
          await db.update('gdm', {'isSynced': 1}, where: 'id = ?', whereArgs: [gdm['id']]);
          _syncLog += '✓ Uploaded GDM Dispatch Memo ${gdm['gdmNumber']}\n';
        }
      }

      _syncLog += '\n✅ Cloud Synchronization successful!';
    } catch (e) {
      _syncLog += '\n❌ Error during sync: Server unreachable or network error.';
    }

    setState(() {
      _isSyncing = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(title: const Text('Cloud Synchronization Engine')),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  children: [
                    const Icon(Icons.sync_problem, size: 48, color: Colors.blue),
                    const SizedBox(height: 12),
                    const Text('Synchronize Offline Registers', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                    const SizedBox(height: 8),
                    Text('Upload local dispatches and download updated seller/buyer master lists.', style: theme.textTheme.bodySmall, textAlign: TextAlign.center)
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),
            ElevatedButton.icon(
              onPressed: _isSyncing ? null : _startSync,
              icon: const Icon(Icons.sync),
              label: const Text('Start Synchronization Bridge', style: TextStyle(fontWeight: FontWeight.bold)),
              style: ElevatedButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 14)),
            ),
            const SizedBox(height: 16),
            const Text('Sync logs:', style: TextStyle(fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            Expanded(
              child: Container(
                padding: const EdgeInsets.all(12),
                color: Colors.black12,
                child: SingleChildScrollView(
                  child: Text(
                    _syncLog,
                    style: const TextStyle(fontFamily: 'monospace', fontSize: 12, color: Colors.black87),
                  ),
                ),
              ),
            )
          ],
        ),
      ),
    );
  }
}

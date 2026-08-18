import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'providers/probe_provider.dart';
import 'screens/home_screen.dart';
import 'theme/app_theme.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const TurboProbeApp());
}

class TurboProbeApp extends StatelessWidget {
  const TurboProbeApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => ProbeProvider()),
      ],
      child: MaterialApp(
        title: 'TurboProbe VPN Filter',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.darkTheme,
        home: const HomeScreen(),
      ),
    );
  }
}

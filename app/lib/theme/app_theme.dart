import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class AppTheme {
  // Google System Palette
  static const Color accent = Color(0xFF1A73E8); // Google Blue #1A73E8
  static const Color primary = accent;

  // Dark Mode Surface & Text (Default)
  static const Color backgroundDark = Color(0xFF121212);
  static const Color surfaceDark = Color(0xFF1E1E1E);
  static const Color surfaceContainerLow = Color(0xFF1A1A1A);
  static const Color surfaceContainer = Color(0xFF242424);
  static const Color surfaceContainerHigh = Color(0xFF2C2C2C);
  static const Color surfaceContainerHighest = Color(0xFF383838);
  static const Color surfaceContainerLowest = Color(0xFF0F0F0F);
  static const Color dividerDark = Color(0xFF2A2A2A);
  static const Color textPrimaryDark = Color(0xFFFFFFFF);
  static const Color textSecondaryDark = Color(0xFF9E9E9E);
  static const Color textTertiaryDark = Color(0xFF6E6E6E);

  // Light Mode Palette
  static const Color backgroundLight = Color(0xFFFAFAFA);
  static const Color surfaceLight = Color(0xFFFFFFFF);
  static const Color dividerLight = Color(0xFFE0E0E0);
  static const Color textPrimaryLight = Color(0xFF1A1A1A);
  static const Color textSecondaryLight = Color(0xFF5F6368);

  // Status & Latency Functional Colors (Only used for small status dots & strips)
  static const Color statusFast = Color(0xFF34A853); // Google Green (<100ms)
  static const Color statusMedium = Color(0xFFFBBC04); // Google Yellow (100-250ms)
  static const Color statusSlow = Color(0xFFEA4335); // Google Red (>250ms)
  static const Color statusDead = Color(0xFF5F6368); // Muted Gray

  // Compatibility aliases
  static const Color surface = backgroundDark;
  static const Color onPrimary = Color(0xFFFFFFFF);
  static const Color primaryContainer = Color(0xFF172B4D);
  static const Color onPrimaryContainer = Color(0xFFD2E3FC);
  static const Color secondary = accent;
  static const Color outline = dividerDark;
  static const Color outlineVariant = dividerDark;
  static const Color success = statusFast;
  static const Color warning = statusMedium;
  static const Color error = statusSlow;
  static const Color textPrimary = textPrimaryDark;
  static const Color textSecondary = textSecondaryDark;

  static Color getPingColor(int pingMs) {
    if (pingMs <= 0 || pingMs >= 9999) return statusDead;
    if (pingMs < 100) return statusFast;
    if (pingMs < 250) return statusMedium;
    return statusSlow;
  }

  static ThemeData get darkTheme {
    final baseTextTheme = GoogleFonts.robotoTextTheme(ThemeData.dark().textTheme);

    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      scaffoldBackgroundColor: backgroundDark,
      colorScheme: const ColorScheme.dark(
        primary: accent,
        onPrimary: Colors.white,
        surface: surfaceDark,
        onSurface: textPrimaryDark,
        surfaceContainerLow: surfaceContainerLow,
        surfaceContainer: surfaceContainer,
        surfaceContainerHigh: surfaceContainerHigh,
        outline: dividerDark,
        outlineVariant: dividerDark,
        error: statusSlow,
      ),
      textTheme: baseTextTheme.copyWith(
        titleLarge: GoogleFonts.roboto(fontSize: 18, fontWeight: FontWeight.w600, color: textPrimaryDark),
        titleMedium: GoogleFonts.roboto(fontSize: 15, fontWeight: FontWeight.w500, color: textPrimaryDark),
        bodyLarge: GoogleFonts.roboto(fontSize: 14, color: textPrimaryDark),
        bodyMedium: GoogleFonts.roboto(fontSize: 13, color: textSecondaryDark),
        bodySmall: GoogleFonts.roboto(fontSize: 12, color: textTertiaryDark),
        labelLarge: GoogleFonts.roboto(fontSize: 13, fontWeight: FontWeight.w500, color: textPrimaryDark),
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: backgroundDark,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: false,
        titleTextStyle: GoogleFonts.roboto(
          fontSize: 18,
          fontWeight: FontWeight.w600,
          color: textPrimaryDark,
          letterSpacing: -0.2,
        ),
        iconTheme: const IconThemeData(color: textPrimaryDark, size: 22),
      ),
      dividerTheme: const DividerThemeData(
        color: dividerDark,
        thickness: 1,
        space: 1,
      ),
      popupMenuTheme: PopupMenuThemeData(
        color: surfaceDark,
        surfaceTintColor: Colors.transparent,
        elevation: 4,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(8),
          side: const BorderSide(color: dividerDark, width: 1),
        ),
        textStyle: GoogleFonts.roboto(fontSize: 13, color: textPrimaryDark),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: surfaceContainerLow,
        hintStyle: GoogleFonts.roboto(color: textSecondaryDark, fontSize: 13),
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: dividerDark, width: 1),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: dividerDark, width: 1),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: accent, width: 1.5),
        ),
      ),
      bottomSheetTheme: const BottomSheetThemeData(
        backgroundColor: surfaceDark,
        surfaceTintColor: Colors.transparent,
        modalBackgroundColor: surfaceDark,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: Colors.white,
          foregroundColor: Colors.black,
          elevation: 0,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
          textStyle: GoogleFonts.roboto(fontSize: 13, fontWeight: FontWeight.w600),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        ),
      ),
    );
  }

  // Mono text style helper for IP, Ports, and Latency
  static TextStyle mono({
    double fontSize = 12,
    FontWeight fontWeight = FontWeight.normal,
    Color color = textPrimaryDark,
  }) {
    return GoogleFonts.robotoMono(
      fontSize: fontSize,
      fontWeight: fontWeight,
      color: color,
    );
  }
}

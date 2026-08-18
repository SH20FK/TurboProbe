import 'package:flutter/material.dart';

class AppTheme {
  static const Color primary = Color(0xFF818CF8); // MD3 Indigo Primary
  static const Color onPrimary = Color(0xFF0F111A);
  static const Color primaryContainer = Color(0xFF3730A3);
  static const Color onPrimaryContainer = Color(0xFFE0E7FF);

  static const Color secondary = Color(0xFF38BDF8); // Cyan Accent
  static const Color primaryAccent = secondary; // Compatibility alias
  static const Color surface = Color(0xFF11131E);
  static const Color surfaceLight = Color(0xFF1E2235); // Compatibility alias
  static const Color surfaceContainerLowest = Color(0xFF0C0E17);
  static const Color surfaceContainerLow = Color(0xFF171A28);
  static const Color surfaceContainer = Color(0xFF1E2235);
  static const Color surfaceContainerHigh = Color(0xFF272D45);
  static const Color surfaceContainerHighest = Color(0xFF333A57);
  static const Color outline = Color(0xFF3B4363);
  static const Color outlineVariant = Color(0xFF262C42);

  static const Color success = Color(0xFF34D399); // Emerald
  static const Color warning = Color(0xFFFBBF24); // Amber
  static const Color error = Color(0xFFF87171); // Coral Red
  static const Color textPrimary = Color(0xFFF8FAFC);
  static const Color textSecondary = Color(0xFF94A3B8);

  static ThemeData get darkTheme {
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      scaffoldBackgroundColor: surface,
      colorScheme: const ColorScheme.dark(
        primary: primary,
        onPrimary: onPrimary,
        primaryContainer: primaryContainer,
        onPrimaryContainer: onPrimaryContainer,
        secondary: secondary,
        surface: surface,
        outline: outline,
        outlineVariant: outlineVariant,
        error: error,
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: surface,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: false,
      ),
      cardTheme: CardTheme(
        color: surfaceContainerLow,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: const BorderSide(color: outlineVariant, width: 1),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: surfaceContainerLow,
        hintStyle: const TextStyle(color: textSecondary, fontSize: 13),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(color: outlineVariant),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(color: outlineVariant),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(color: primary, width: 1.5),
        ),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: primary,
          foregroundColor: onPrimary,
          elevation: 0,
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          textStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
        ),
      ),
      chipTheme: ChipThemeData(
        backgroundColor: surfaceContainerLow,
        selectedColor: primaryContainer,
        disabledColor: surface,
        side: const BorderSide(color: outlineVariant),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        labelStyle: const TextStyle(fontSize: 12, color: textPrimary),
      ),
      bottomSheetTheme: const BottomSheetThemeData(
        backgroundColor: surfaceContainerLow,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
        ),
      ),
      dialogTheme: DialogTheme(
        backgroundColor: surfaceContainerLow,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      ),
    );
  }

  static Color getPingColor(num pingNum) {
    final ping = pingNum.toInt();
    if (ping <= 0 || ping >= 9999) return error;
    if (ping < 100) return success;
    if (ping < 250) return warning;
    return error;
  }
}

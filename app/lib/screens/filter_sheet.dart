import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../providers/probe_provider.dart';
import '../theme/app_theme.dart';

class FilterSheet extends StatefulWidget {
  final ProbeProvider provider;

  const FilterSheet({super.key, required this.provider});

  static Future<void> show(BuildContext context, ProbeProvider provider) {
    FocusScope.of(context).unfocus();
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: AppTheme.surfaceDark,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (context) => FilterSheet(provider: provider),
    );
  }

  @override
  State<FilterSheet> createState() => _FilterSheetState();
}

class _FilterSheetState extends State<FilterSheet> {
  late String _selectedRUCategory;
  late String _selectedProtocol;
  late String _selectedCountry;
  late SortOption _sortOption;

  final ruCategories = const [
    {'id': 'ALL', 'label': 'Все сервисы'},
    {'id': 'YOUTUBE', 'label': '🎬 YouTube 4K'},
    {'id': 'DISCORD', 'label': '💬 Discord'},
    {'id': 'REALITY', 'label': '🛡 Анти-ТСПУ Reality'},
    {'id': 'STREAM_4K', 'label': '⚡ 4K HDR Скорость (50+ Мб/с)'},
    {'id': 'CLEAN_IP', 'label': '✨ Чистый IP (Без капчи)'},
    {'id': 'UNIQUE_HOSTS', 'label': '🔗 Без клонов (Уникальные)'},
    {'id': 'AI', 'label': '🤖 ChatGPT'},
  ];

  @override
  void initState() {
    super.initState();
    _selectedRUCategory = widget.provider.selectedRUCategory;
    _selectedProtocol = widget.provider.selectedProtocol;
    _selectedCountry = widget.provider.selectedCountry;
    _sortOption = widget.provider.sortOption;
  }

  void _reset() {
    setState(() {
      _selectedRUCategory = 'ALL';
      _selectedProtocol = 'ALL';
      _selectedCountry = 'ALL';
      _sortOption = SortOption.pingAsc;
    });
  }

  void _apply() {
    widget.provider.setRUCategoryFilter(_selectedRUCategory);
    widget.provider.setProtocolFilter(_selectedProtocol);
    widget.provider.setCountryFilter(_selectedCountry);
    widget.provider.setSortOption(_sortOption);
    Navigator.pop(context);
  }

  @override
  Widget build(BuildContext context) {
    final protocols = widget.provider.availableProtocols;
    final countries = widget.provider.availableCountries;

    return Container(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.85,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Header
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 16, 12, 12),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'Фильтры и сортировка',
                  style: GoogleFonts.roboto(fontSize: 16, fontWeight: FontWeight.w600, color: AppTheme.textPrimaryDark),
                ),
                Row(
                  children: [
                    TextButton(
                      onPressed: _reset,
                      child: Text('Сбросить', style: GoogleFonts.roboto(fontSize: 13, color: AppTheme.textSecondaryDark)),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close, size: 20, color: AppTheme.textSecondaryDark),
                      onPressed: () => Navigator.pop(context),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const Divider(height: 1, color: AppTheme.dividerDark),

          // Scrollable Sections
          Expanded(
            child: ListView(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
              children: [
                // 1. Сортировка
                _buildSectionTitle('Сортировка'),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    _buildChoiceChip('По пингу (быстрые)', _sortOption == SortOption.pingAsc, () {
                      setState(() => _sortOption = SortOption.pingAsc);
                    }),
                    _buildChoiceChip('По очкам (Score)', _sortOption == SortOption.scoreDesc, () {
                      setState(() => _sortOption = SortOption.scoreDesc);
                    }),
                    _buildChoiceChip('По стране', _sortOption == SortOption.country, () {
                      setState(() => _sortOption = SortOption.country);
                    }),
                    _buildChoiceChip('По протоколу', _sortOption == SortOption.protocol, () {
                      setState(() => _sortOption = SortOption.protocol);
                    }),
                  ],
                ),
                const SizedBox(height: 20),

                // 2. Разблокировка и критерии качества
                _buildSectionTitle('Критерии качества и сервисы'),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: ruCategories.map((cat) {
                    final isSelected = _selectedRUCategory == cat['id'];
                    return _buildChoiceChip(cat['label']!, isSelected, () {
                      setState(() => _selectedRUCategory = cat['id']!);
                    });
                  }).toList(),
                ),
                const SizedBox(height: 20),

                // 3. Протоколы
                if (protocols.length > 1) ...[
                  _buildSectionTitle('Протоколы'),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: protocols.map((proto) {
                      final isSelected = _selectedProtocol == proto;
                      final label = proto == 'ALL' ? 'Все' : proto;
                      return _buildChoiceChip(label, isSelected, () {
                        setState(() => _selectedProtocol = proto);
                      });
                    }).toList(),
                  ),
                  const SizedBox(height: 20),
                ],

                // 4. Страны
                if (countries.length > 1) ...[
                  _buildSectionTitle('Страны'),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: countries.map((c) {
                      final isSelected = _selectedCountry == c;
                      final label = c == 'ALL' ? 'Все страны' : c;
                      return _buildChoiceChip(label, isSelected, () {
                        setState(() => _selectedCountry = c);
                      });
                    }).toList(),
                  ),
                  const SizedBox(height: 16),
                ],
              ],
            ),
          ),

          // Bottom Action Button
          Container(
            padding: const EdgeInsets.all(16),
            decoration: const BoxDecoration(
              color: AppTheme.surfaceDark,
              border: Border(top: BorderSide(color: AppTheme.dividerDark, width: 1)),
            ),
            child: SizedBox(
              width: double.infinity,
              height: 44,
              child: FilledButton(
                style: FilledButton.styleFrom(
                  backgroundColor: AppTheme.accent,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                ),
                onPressed: _apply,
                child: Text('Применить', style: GoogleFonts.roboto(fontSize: 14, fontWeight: FontWeight.w600)),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSectionTitle(String title) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Text(
        title.toUpperCase(),
        style: GoogleFonts.roboto(fontSize: 11, fontWeight: FontWeight.w700, color: AppTheme.textTertiaryDark, letterSpacing: 0.5),
      ),
    );
  }

  Widget _buildChoiceChip(String label, bool isSelected, VoidCallback onTap) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(6),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
        decoration: BoxDecoration(
          color: isSelected ? AppTheme.accent.withOpacity(0.18) : AppTheme.surfaceContainerLow,
          borderRadius: BorderRadius.circular(6),
          border: Border.all(
            color: isSelected ? AppTheme.accent : AppTheme.dividerDark,
            width: 1,
          ),
        ),
        child: Text(
          label,
          style: GoogleFonts.roboto(
            fontSize: 13,
            fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
            color: isSelected ? Colors.white : AppTheme.textPrimaryDark,
          ),
        ),
      ),
    );
  }
}

import 'package:flutter/material.dart';
import '../providers/probe_provider.dart';
import '../theme/app_theme.dart';

class FilterBar extends StatelessWidget {
  final ProbeProvider provider;

  const FilterBar({super.key, required this.provider});

  @override
  Widget build(BuildContext context) {
    final protocols = provider.availableProtocols;
    final countries = provider.availableCountries;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Search & Sort Row
          Row(
            children: [
              Expanded(
                child: TextField(
                  onChanged: provider.setSearchQuery,
                  style: const TextStyle(fontSize: 13),
                  decoration: InputDecoration(
                    hintText: 'Поиск по имени, IP или стране...',
                    prefixIcon: const Icon(Icons.search_rounded, size: 18, color: AppTheme.primary),
                    suffixIcon: provider.searchQuery.isNotEmpty
                        ? IconButton(
                            icon: const Icon(Icons.clear, size: 16, color: AppTheme.textSecondary),
                            onPressed: () => provider.setSearchQuery(''),
                          )
                        : null,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              // Sort Menu
              PopupMenuButton<SortOption>(
                icon: Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppTheme.surfaceContainerLow,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: AppTheme.outlineVariant),
                  ),
                  child: const Icon(Icons.sort_rounded, size: 20, color: AppTheme.primary),
                ),
                color: AppTheme.surfaceContainer,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                onSelected: provider.setSortOption,
                itemBuilder: (context) => [
                  const PopupMenuItem(
                    value: SortOption.pingAsc,
                    child: Text('⚡ По пингу (быстрые первые)'),
                  ),
                  const PopupMenuItem(
                    value: SortOption.scoreDesc,
                    child: Text('🏆 По очкам качества (Score)'),
                  ),
                  const PopupMenuItem(
                    value: SortOption.country,
                    child: Text('🌐 По стране'),
                  ),
                  const PopupMenuItem(
                    value: SortOption.protocol,
                    child: Text('🔒 По протоколу'),
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 8),

          // Protocol Filter Chips
          if (protocols.length > 2)
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: protocols.map((proto) {
                  final isSelected = provider.selectedProtocol == proto;
                  return Padding(
                    padding: const EdgeInsets.only(right: 6),
                    child: FilterChip(
                      label: Text(proto == 'ALL' ? 'Все протоколы' : proto),
                      selected: isSelected,
                      onSelected: (_) => provider.setProtocolFilter(proto),
                    ),
                  );
                }).toList(),
              ),
            ),

          if (countries.length > 2) ...[
            const SizedBox(height: 6),
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: countries.map((c) {
                  final isSelected = provider.selectedCountry == c;
                  return Padding(
                    padding: const EdgeInsets.only(right: 6),
                    child: FilterChip(
                      label: Text(c == 'ALL' ? '🌐 Все страны' : c),
                      selected: isSelected,
                      onSelected: (_) => provider.setCountryFilter(c),
                    ),
                  );
                }).toList(),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

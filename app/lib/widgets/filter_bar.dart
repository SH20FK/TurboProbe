import 'package:flutter/material.dart';
import '../providers/probe_provider.dart';
import '../theme/app_theme.dart';

class FilterBar extends StatelessWidget {
  final ProbeProvider provider;

  const FilterBar({super.key, required this.provider});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Column(
        children: [
          // Search Field
          TextField(
            onChanged: provider.setSearchQuery,
            decoration: InputDecoration(
              hintText: 'Search by name, IP or country...',
              prefixIcon: const Icon(Icons.search, size: 20, color: AppTheme.textSecondary),
              suffixIcon: provider.searchQuery.isNotEmpty
                  ? IconButton(
                      icon: const Icon(Icons.clear, size: 18, color: AppTheme.textSecondary),
                      onPressed: () => provider.setSearchQuery(''),
                    )
                  : null,
            ),
          ),
          const SizedBox(height: 10),
          // Filter & Sort Row
          Row(
            children: [
              // Protocol Dropdown
              Expanded(
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  decoration: BoxDecoration(
                    color: AppTheme.surface,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: AppTheme.border),
                  ),
                  child: DropdownButtonHideUnderline(
                    child: DropdownButton<String>(
                      value: provider.selectedProtocol,
                      isExpanded: true,
                      dropdownColor: AppTheme.surface,
                      items: provider.availableProtocols.map((proto) {
                        return DropdownMenuItem(
                          value: proto,
                          child: Text(
                            proto == 'ALL' ? 'Protocol: All' : proto,
                            style: const TextStyle(fontSize: 13, color: AppTheme.textPrimary),
                          ),
                        );
                      }).toList(),
                      onChanged: (val) {
                        if (val != null) provider.setProtocolFilter(val);
                      },
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              // Country Dropdown
              Expanded(
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  decoration: BoxDecoration(
                    color: AppTheme.surface,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: AppTheme.border),
                  ),
                  child: DropdownButtonHideUnderline(
                    child: DropdownButton<String>(
                      value: provider.selectedCountry,
                      isExpanded: true,
                      dropdownColor: AppTheme.surface,
                      items: provider.availableCountries.map((country) {
                        return DropdownMenuItem(
                          value: country,
                          child: Text(
                            country == 'ALL' ? 'Country: All' : country,
                            style: const TextStyle(fontSize: 13, color: AppTheme.textPrimary),
                          ),
                        );
                      }).toList(),
                      onChanged: (val) {
                        if (val != null) provider.setCountryFilter(val);
                      },
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              // Sort Menu Button
              PopupMenuButton<SortOption>(
                icon: Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: AppTheme.surface,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: AppTheme.border),
                  ),
                  child: const Icon(Icons.sort_rounded, size: 20, color: AppTheme.textPrimary),
                ),
                color: AppTheme.surface,
                onSelected: provider.setSortOption,
                itemBuilder: (context) => [
                  const PopupMenuItem(
                    value: SortOption.pingAsc,
                    child: Text('Sort by Ping (Lowest first)'),
                  ),
                  const PopupMenuItem(
                    value: SortOption.scoreDesc,
                    child: Text('Sort by Quality Score'),
                  ),
                  const PopupMenuItem(
                    value: SortOption.country,
                    child: Text('Sort by Country'),
                  ),
                  const PopupMenuItem(
                    value: SortOption.protocol,
                    child: Text('Sort by Protocol'),
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }
}

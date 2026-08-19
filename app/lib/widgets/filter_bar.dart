import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../providers/probe_provider.dart';
import '../screens/filter_sheet.dart';
import '../theme/app_theme.dart';

class FilterBar extends StatelessWidget {
  final ProbeProvider provider;

  const FilterBar({super.key, required this.provider});

  @override
  Widget build(BuildContext context) {
    final activeFilters = provider.activeFilterCount;

    return Container(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
      decoration: const BoxDecoration(
        color: AppTheme.backgroundDark,
        border: Border(bottom: BorderSide(color: AppTheme.dividerDark, width: 1)),
      ),
      child: Column(
        children: [
          // 1. Search Bar + Filter Button Row
          Row(
            children: [
              // Search Input
              Expanded(
                child: SizedBox(
                  height: 38,
                  child: TextField(
                    onChanged: provider.setSearchQuery,
                    textAlignVertical: TextAlignVertical.center,
                    style: GoogleFonts.roboto(fontSize: 13, color: AppTheme.textPrimaryDark),
                    decoration: InputDecoration(
                      hintText: 'Поиск по имени, IP или стране...',
                      hintStyle: GoogleFonts.roboto(fontSize: 13, color: AppTheme.textSecondaryDark),
                      isDense: true,
                      contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                      prefixIcon: const Icon(Icons.search, size: 18, color: AppTheme.textSecondaryDark),
                      suffixIcon: provider.searchQuery.isNotEmpty
                          ? IconButton(
                              icon: const Icon(Icons.clear, size: 16, color: AppTheme.textSecondaryDark),
                              onPressed: () => provider.setSearchQuery(''),
                            )
                          : null,
                      filled: true,
                      fillColor: AppTheme.surfaceContainerLow,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(6),
                        borderSide: const BorderSide(color: AppTheme.dividerDark, width: 1),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(6),
                        borderSide: const BorderSide(color: AppTheme.dividerDark, width: 1),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(6),
                        borderSide: const BorderSide(color: AppTheme.accent, width: 1.5),
                      ),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 8),

              // Filter Button (Opens FilterSheet)
              InkWell(
                onTap: () => FilterSheet.show(context, provider),
                borderRadius: BorderRadius.circular(6),
                child: Container(
                  height: 38,
                  padding: const EdgeInsets.symmetric(horizontal: 10),
                  decoration: BoxDecoration(
                    color: activeFilters > 0 ? AppTheme.accent.withOpacity(0.18) : AppTheme.surfaceContainerLow,
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(
                      color: activeFilters > 0 ? AppTheme.accent : AppTheme.dividerDark,
                      width: 1,
                    ),
                  ),
                  child: Row(
                    children: [
                      Icon(
                        Icons.tune,
                        size: 16,
                        color: activeFilters > 0 ? AppTheme.accent : AppTheme.textSecondaryDark,
                      ),
                      if (activeFilters > 0) ...[
                        const SizedBox(width: 5),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                          decoration: BoxDecoration(
                            color: AppTheme.accent,
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Text(
                            '$activeFilters',
                            style: GoogleFonts.roboto(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.white),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),

          // 2. 3-Segment Quick Control (Все / Живые / ТОП-20)
          Container(
            height: 32,
            decoration: BoxDecoration(
              color: AppTheme.surfaceContainerLow,
              borderRadius: BorderRadius.circular(6),
              border: Border.all(color: AppTheme.dividerDark, width: 1),
            ),
            child: Row(
              children: [
                _buildSegmentItem('Все (${provider.totalCount})', QuickFilter.all),
                const VerticalDivider(width: 1, color: AppTheme.dividerDark),
                _buildSegmentItem('Живые (${provider.aliveCount})', QuickFilter.alive),
                const VerticalDivider(width: 1, color: AppTheme.dividerDark),
                _buildSegmentItem('ТОП 20', QuickFilter.top),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSegmentItem(String label, QuickFilter filter) {
    final isSelected = provider.quickFilter == filter;

    return Expanded(
      child: InkWell(
        onTap: () => provider.setQuickFilter(filter),
        borderRadius: BorderRadius.circular(5),
        child: Container(
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: isSelected ? AppTheme.surfaceContainerHighest : Colors.transparent,
            borderRadius: BorderRadius.circular(5),
          ),
          child: Text(
            label,
            style: GoogleFonts.roboto(
              fontSize: 12,
              fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
              color: isSelected ? Colors.white : AppTheme.textSecondaryDark,
            ),
          ),
        ),
      ),
    );
  }
}

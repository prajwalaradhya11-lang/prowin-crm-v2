import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { THEME } from '../../lib/prowinTheme';
import {
  buildStubEnquiries,
  buildPropertyRequirementRows,
  buildLeadInfoRows,
  formatEnquiryDate,
  type EnquiryEntry,
} from '../../lib/leadEnquiry';

type LeadEnquiryTabProps = {
  lead: Parameters<typeof buildStubEnquiries>[0] &
    Parameters<typeof buildPropertyRequirementRows>[0] &
    Parameters<typeof buildLeadInfoRows>[0];
  enquiries?: EnquiryEntry[];
};

export function LeadEnquiryTab({ lead, enquiries }: LeadEnquiryTabProps) {
  const timeline = enquiries ?? buildStubEnquiries(lead);
  const showReEnquiry = timeline.length > 1;
  const propertyRows = buildPropertyRequirementRows(lead);
  const infoRows = buildLeadInfoRows(lead);

  return (
    <View style={s.wrap}>
      {showReEnquiry && (
        <View style={s.reBanner}>
          <Ionicons name="repeat" size={14} color={THEME.red} />
          <Text style={s.reBannerText}>
            Re-enquired {timeline.length} times · Same phone · matched to this lead
          </Text>
        </View>
      )}

      <View style={s.timelineCard}>
        <Text style={s.cardLabel}>Enquiry timeline</Text>
        {timeline.map((entry, index) => (
          <View key={entry.id} style={s.timelineRow}>
            <View style={s.timelineLine}>
              <View style={[s.dot, entry.isLatest ? s.dotLatest : s.dotOld]} />
              {index < timeline.length - 1 && <View style={s.line} />}
            </View>
            <View style={s.timelineContent}>
              <View style={s.timelineTop}>
                <Text style={s.campaign}>{entry.campaign}</Text>
                {entry.isLatest && (
                  <View style={s.latestBadge}>
                    <Text style={s.latestText}>latest</Text>
                  </View>
                )}
              </View>
              <Text style={s.source}>{entry.source}</Text>
              <Text style={s.date}>{formatEnquiryDate(entry.date)}</Text>
              {entry.isFirst && !entry.isLatest && (
                <Text style={s.firstTag}>first enquiry</Text>
              )}
              {entry.isFirst && entry.isLatest && timeline.length === 1 && (
                <Text style={s.firstTag}>first enquiry</Text>
              )}
            </View>
          </View>
        ))}
      </View>

      {propertyRows.length > 0 && (
        <View style={s.fieldCard}>
          <Text style={s.cardLabel}>Property requirement</Text>
          {propertyRows.map(row => (
            <View key={row.label} style={s.fieldRow}>
              <Text style={s.fieldLabel}>{row.label}</Text>
              <Text style={s.fieldValue}>{row.value}</Text>
            </View>
          ))}
        </View>
      )}

      {infoRows.length > 0 && (
        <View style={s.fieldCard}>
          <Text style={s.cardLabel}>Lead info</Text>
          {infoRows.map(row => (
            <View key={row.label} style={s.fieldRow}>
              <Text style={s.fieldLabel}>{row.label}</Text>
              <Text style={[
                s.fieldValue,
                row.label === 'Serial no.' && s.mono,
              ]}>{row.value}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { padding: 14, gap: 10 },
  reBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: THEME.redTintFill,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: THEME.redTintBorder,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  reBannerText: { flex: 1, fontSize: 12, fontWeight: '600', color: THEME.red },
  timelineCard: {
    backgroundColor: THEME.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: THEME.border,
    borderTopWidth: 3,
    borderTopColor: THEME.red,
    padding: 14,
  },
  cardLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: THEME.meta,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 12,
  },
  timelineRow: { flexDirection: 'row', gap: 10, minHeight: 64 },
  timelineLine: { width: 14, alignItems: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5 },
  dotLatest: { backgroundColor: THEME.red },
  dotOld: { backgroundColor: '#d8a49c' },
  line: {
    flex: 1,
    width: 2,
    backgroundColor: THEME.border,
    marginVertical: 2,
  },
  timelineContent: { flex: 1, paddingBottom: 12 },
  timelineTop: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  campaign: { fontSize: 14, fontWeight: '800', color: THEME.heading },
  latestBadge: {
    backgroundColor: THEME.greenFill,
    borderWidth: 1,
    borderColor: THEME.greenBorder,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  latestText: { fontSize: 9, fontWeight: '800', color: THEME.green, textTransform: 'uppercase' },
  source: { fontSize: 12, color: THEME.meta, marginTop: 2 },
  date: { fontSize: 11, color: THEME.meta, marginTop: 4 },
  firstTag: { fontSize: 10, fontWeight: '700', color: '#d8a49c', marginTop: 4 },
  fieldCard: {
    backgroundColor: THEME.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: THEME.border,
    padding: 14,
  },
  fieldRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: THEME.border,
  },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: THEME.meta },
  fieldValue: { fontSize: 13, fontWeight: '700', color: THEME.heading, flex: 1, textAlign: 'right' },
  mono: { fontFamily: 'monospace' },
});

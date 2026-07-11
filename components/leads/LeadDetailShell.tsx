import React, { useCallback, useRef } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
  ScrollView,
} from 'react-native';
import { THEME } from '../../lib/prowinTheme';
import { LeadDetailHeader } from './LeadDetailHeader';
import { LeadDetailTabBar, LEAD_DETAIL_TABS, type LeadDetailTabId } from './LeadDetailTabBar';
import { getName, type LeadNameFields } from '../../lib/leadName';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type LeadDetailShellProps = {
  lead: LeadNameFields & {
    phone?: string | null;
    email?: string | null;
  };
  activeTabIndex: number;
  onTabIndexChange: (index: number) => void;
  onBack: () => void;
  onEdit: () => void;
  onCall: () => void;
  onWhatsApp: () => void;
  onSms: () => void;
  onLog: () => void;
  renderTab: (tabId: LeadDetailTabId) => React.ReactElement;
};

export function LeadDetailShell({
  lead,
  activeTabIndex,
  onTabIndexChange,
  onBack,
  onEdit,
  onCall,
  onWhatsApp,
  onSms,
  onLog,
  renderTab,
}: LeadDetailShellProps) {
  const pagerRef = useRef<FlatList>(null);

  const selectTab = useCallback((index: number) => {
    onTabIndexChange(index);
    pagerRef.current?.scrollToIndex({ index, animated: true });
  }, [onTabIndexChange]);

  function onPagerScrollEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    if (index >= 0 && index < LEAD_DETAIL_TABS.length && index !== activeTabIndex) {
      onTabIndexChange(index);
    }
  }

  return (
    <View style={s.container}>
      <LeadDetailHeader
        lead={lead}
        onBack={onBack}
        onEdit={onEdit}
        onCall={onCall}
        onWhatsApp={onWhatsApp}
        onSms={onSms}
        onLog={onLog}
      />

      <FlatList
        ref={pagerRef}
        style={s.pager}
        data={LEAD_DETAIL_TABS}
        keyExtractor={item => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onPagerScrollEnd}
        onScrollToIndexFailed={info => {
          pagerRef.current?.scrollToOffset({
            offset: info.averageItemLength * info.index,
            animated: false,
          });
        }}
        getItemLayout={(_, index) => ({
          length: SCREEN_WIDTH,
          offset: SCREEN_WIDTH * index,
          index,
        })}
        renderItem={({ item }) => (
          <ScrollView
            style={{ width: SCREEN_WIDTH }}
            contentContainerStyle={s.pageContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {renderTab(item.id)}
          </ScrollView>
        )}
      />

      <LeadDetailTabBar activeIndex={activeTabIndex} onTabPress={selectTab} />
    </View>
  );
}

export function getLeadDetailTitle(lead: LeadNameFields): string {
  return getName(lead);
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.page },
  pager: { flex: 1 },
  pageContent: { flexGrow: 1, paddingBottom: 16 },
});

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { THEME } from '../../lib/prowinTheme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export type StatusTabItem = {
  key: string;
  label: string;
  count: number;
};

type LeadStatusTabsPagerProps = {
  tabs: StatusTabItem[];
  activeIndex: number;
  onIndexChange: (index: number) => void;
  renderPage: (tab: StatusTabItem, index: number) => React.ReactElement;
};

export function LeadStatusTabsPager({
  tabs,
  activeIndex,
  onIndexChange,
  renderPage,
}: LeadStatusTabsPagerProps) {
  const pagerRef = useRef<FlatList>(null);
  const activeTab = tabs[activeIndex];

  useEffect(() => {
    if (activeIndex >= 0 && activeIndex < tabs.length) {
      pagerRef.current?.scrollToIndex({ index: activeIndex, animated: false });
    }
  }, [activeIndex, tabs.length]);

  function onPagerScrollEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    if (index >= 0 && index < tabs.length && index !== activeIndex) {
      onIndexChange(index);
    }
  }

  return (
    <View style={s.wrap}>
      <View style={s.filterRow}>
        <Text style={s.filterLabel}>
          {activeTab ? `${activeTab.label} · ${activeTab.count}` : ''}
        </Text>
        <Text style={s.swipeHint}>Swipe to filter</Text>
      </View>

      <View style={s.dotsRow}>
        {tabs.map((tab, index) => (
          <View
            key={tab.key}
            style={[s.dot, index === activeIndex && s.dotActive]}
          />
        ))}
      </View>

      <FlatList
        ref={pagerRef}
        style={s.pagerList}
        data={tabs}
        keyExtractor={item => item.key}
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
        renderItem={({ item, index }) => (
          <View style={{ width: SCREEN_WIDTH }}>
            {renderPage(item, index)}
          </View>
        )}
      />
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1 },
  pagerList: { flex: 1 },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingBottom: 4,
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: THEME.heading,
  },
  swipeHint: {
    fontSize: 10,
    fontWeight: '600',
    color: THEME.meta,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 5,
    paddingBottom: 8,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: THEME.border,
  },
  dotActive: {
    width: 14,
    backgroundColor: THEME.red,
  },
});

export { SCREEN_WIDTH as LEAD_PAGER_WIDTH };

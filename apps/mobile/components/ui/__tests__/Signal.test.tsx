import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { AccessibilityInfo, Modal, StyleSheet, Text, View, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Chip, Segments, PageHeading, Notice, Sheet, Screen, layout } from '../Signal';
import { BrandSignature } from '@/components/BrandMark';
import { renderRouter, screen } from 'expo-router/testing-library';
import TabLayout from '@/app/(tabs)/_layout';
import { TopBar, TopBarAction } from '@/components/TopBar';
import { colors, radius, space } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
let mockAppearance: 'light' | 'dark' = 'light';
jest.mock('@/contexts/PreferencesContext', () => ({ usePreferences: () => ({ appearance: mockAppearance }) }));
beforeEach(() => { jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true); });
afterEach(() => jest.restoreAllMocks());

it.each(['light', 'dark'] as const)('%s Later choice exposes trailing time and wraps within a growing touch target', mode => {
  mockAppearance = mode;
  const press = jest.fn();
  const view = render(<Button title="This weekend" detail="Saturday, 9 am" onPress={press} />);
  const button = view.getByRole('button', { name: 'This weekend, Saturday, 9 am' });
  expect(view.getByText('Saturday, 9 am')).toBeTruthy();
  fireEvent.press(button);
  expect(press).toHaveBeenCalledTimes(1);
  const style = StyleSheet.flatten(button.props.style);
  expect(style.minHeight).toBeGreaterThanOrEqual(44);
  expect(style.height).toBeUndefined();
  expect(style.flexWrap).toBe('wrap');
  for (const label of ['This weekend', 'Saturday, 9 am']) {
    const text = view.getByText(label);
    expect(text.props.maxFontSizeMultiplier).toBe(1.3);
    expect(text.props.numberOfLines).toBeUndefined();
    expect(StyleSheet.flatten(text.props.style).flexShrink).toBe(1);
  }
});

it.each(['light', 'dark'] as const)('%s keyboard focus is visible without changing control geometry', mode => {
  mockAppearance = mode;
  const view = render(<Button title="Later" primary onPress={() => {}} />);
  const button = view.getByRole('button', { name: 'Later' });
  fireEvent(button, 'focus');
  const focused = StyleSheet.flatten(button.props.style);
  expect(focused.outlineColor).toBe(colors[mode].focus);
  expect(focused.outlineWidth).toBe(2);
  expect(focused.outlineOffset).toBe(2);
  fireEvent(button, 'blur');
  expect(StyleSheet.flatten(button.props.style).outlineWidth).toBe(0);
});

it.each(['light', 'dark'] as const)('%s caps control labels while content and rows can grow and wrap', mode => {
  mockAppearance = mode;
  const view = render(<>
    <PageHeading title="A long content heading" subtitle="Uncapped content" />
    <Chip label="Unread saves" selected={false} onPress={() => {}} />
    <Segments options={[{ label: 'For you', value: 'for_you' }, { label: 'Following', value: 'following' }]} value="for_you" onChange={() => {}} />
    <Notice message="A long status that grows with your text" action="Retry" onAction={() => {}} />
  </>);
  for (const label of ['Unread saves', 'For you', 'Following']) {
    expect(view.getByText(label).props.maxFontSizeMultiplier).toBe(1.3);
    expect(view.getByText(label).props.numberOfLines).toBeUndefined();
  }
  for (const content of ['A long content heading', 'Uncapped content', 'A long status that grows with your text']) expect(view.getByText(content).props.maxFontSizeMultiplier).toBeUndefined();
  expect(layout.row.flexWrap).toBe('wrap');
  expect(layout.between.flexWrap).toBe('wrap');
});

it.each(['light', 'dark'] as const)('%s filter, scope and icon controls expose visible focus and touch targets', mode => {
  mockAppearance = mode;
  const view = render(<>
    <Chip label="Unread" selected={false} onPress={() => {}} />
    <Segments options={[{ label: 'For you', value: 'for_you' }]} value="for_you" onChange={() => {}} />
    <TopBarAction label="Your profile" icon="person-outline" onPress={() => {}} />
  </>);
  for (const control of [view.getByRole('button', { name: 'Unread' }), view.getByRole('tab', { name: 'For you' }), view.getByRole('button', { name: 'Your profile' })]) {
    fireEvent(control, 'focus');
    expect(StyleSheet.flatten(control.props.style).outlineColor).toBe(colors[mode].focus);
    expect(StyleSheet.flatten(control.props.style).outlineWidth).toBe(2);
    fireEvent(control, 'blur');
    expect(StyleSheet.flatten(control.props.style).outlineWidth).toBe(0);
  }
});

it.each(['light', 'dark'] as const)('%s destination labels cap at 1.3x and keep visible keyboard focus', mode => {
  mockAppearance = mode;
  renderRouter({ '(tabs)/_layout': TabLayout, '(tabs)/index': () => null, '(tabs)/capture': () => null, '(tabs)/library': () => null, '(tabs)/profile': () => null, '(tabs)/explore': () => null });
  for (const name of ['Home', 'Save', 'Library']) {
    expect(screen.getByText(name).props.maxFontSizeMultiplier).toBe(1.3);
    const target = screen.getByLabelText(new RegExp(`^${name}, tab,`));
    fireEvent(target, 'focus');
    expect(StyleSheet.flatten(target.props.style).outlineColor).toBe(colors[mode].focus);
    expect(StyleSheet.flatten(target.props.style).outlineWidth).toBe(2);
  }
});

it('keeps a newly opened sheet still before the reduced-motion preference resolves', () => {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockReturnValue(new Promise(() => {}));
  const view = render(<Sheet title="Later" visible onClose={() => {}}><Button title="Tonight" onPress={() => {}} /></Sheet>);
  expect(view.UNSAFE_getByType(Modal).props.animationType).toBe('none');
});

it('allows a long chrome heading to wrap at the control-label cap', () => {
  const view = render(<TopBar title="A longer chrome heading that needs room to grow" />);
  const title = view.getByRole('header', { name: 'A longer chrome heading that needs room to grow' });
  expect(title.props.maxFontSizeMultiplier).toBe(1.3);
  expect(title.props.numberOfLines).toBeUndefined();
});
it.each(['light', 'dark'] as const)('%s Home header opts into black chrome, white controls and an unboxed brand without recoloring the body', mode => {
  mockAppearance = mode;
  const c = colors[mode];
  const view = render(<Screen title="Cosmic Dolphin" appearance="home" actions={<TopBarAction appearance="home" icon="search-outline" label="Search" onPress={() => {}} />}>
    <Chip appearance="home" label="All topics" selected onPress={() => {}} />
    <Chip appearance="home" label="Design" selected={false} onPress={() => {}} />
    <Text>Normal body</Text>
  </Screen>);
  expect(StyleSheet.flatten(view.UNSAFE_getByType(SafeAreaView).props.style).backgroundColor).toBe(c.homeHeaderBg);
  expect(StyleSheet.flatten(view.UNSAFE_getByType(TopBar).findAllByType(View)[0].props.style).backgroundColor).toBe(c.homeHeaderBg);
  const brand = StyleSheet.flatten(view.UNSAFE_getByType(BrandSignature).findAllByType(View)[0].props.style);
  expect(brand.borderWidth ?? 0).toBe(0);
  expect(brand.borderRadius).toBeUndefined();
  expect(view.UNSAFE_getByType(Ionicons).props.color).toBe(c.homeHeaderFg);
  const body = view.UNSAFE_getAllByType(View).find(node => StyleSheet.flatten(node.props.style)?.maxWidth === 760)!;
  expect(StyleSheet.flatten(body.props.style).backgroundColor).toBe(c.bg);
  expect(view.UNSAFE_getAllByType(Image).some(node => node.props.source === require('@/assets/images/brand-gradient.png'))).toBe(false);
  expect(StyleSheet.flatten(view.getByText('Cosmic Dolphin').props.style).color).toBe(c.homeHeaderFg);
  for (const name of ['Search', 'All topics', 'Design']) {
    const control = view.getByRole('button', { name });
    const style = StyleSheet.flatten(control.props.style);
    expect(style.minHeight ?? style.height).toBeGreaterThanOrEqual(44);
    fireEvent(control, 'focus');
    expect(StyleSheet.flatten(control.props.style).outlineColor).toBe(c.homeHeaderFocus);
    expect(StyleSheet.flatten(control.props.style).outlineWidth).toBe(2);
    fireEvent(control, 'blur');
    expect(StyleSheet.flatten(control.props.style).outlineWidth).toBe(0);
  }
  expect(StyleSheet.flatten(view.getByRole('button', { name: 'All topics' }).props.style).backgroundColor).toBe(c.homeHeaderFg);
  expect(StyleSheet.flatten(view.getByText('All topics').props.style).color).toBe(c.homeHeaderBg);
  expect(StyleSheet.flatten(view.getByText('Design').props.style).color).toBe(c.homeHeaderFg);
  expect(view.getByRole('button', { name: 'All topics' }).props.accessibilityState.selected).toBe(true);
});
it.each(['light', 'dark'] as const)('%s default Screen, TopBar, BrandSignature and Chip remain on the existing theme', mode => {
  mockAppearance = mode;
  const c = colors[mode];
  const view = render(<Screen title="Library"><BrandSignature /><Chip label="Default chip" selected onPress={() => {}} /></Screen>);
  expect(StyleSheet.flatten(view.UNSAFE_getByType(SafeAreaView).props.style).backgroundColor).toBe(c.bg);
  expect(StyleSheet.flatten(view.UNSAFE_getByType(TopBar).findAllByType(View)[0].props.style).backgroundColor).toBe(c.bg);
  const brand = StyleSheet.flatten(view.UNSAFE_getByType(BrandSignature).findAllByType(View)[0].props.style);
  expect(brand.borderRadius).toBe(radius.pill);
  expect(brand.borderColor).toBe(colors.light.brandEdge);
  expect(brand.backgroundColor).toBe(colors.light.brandBlack);
  expect(brand.paddingRight).toBe(space.s3);
  expect(view.UNSAFE_getAllByType(Image).some(node => node.props.source === require('@/assets/images/brand-gradient.png'))).toBe(true);
  expect(StyleSheet.flatten(view.getByRole('button', { name: 'Default chip' }).props.style).backgroundColor).toBe(c.accent);
  expect(StyleSheet.flatten(view.getByText('Default chip').props.style).color).toBe(c.accentFg);
  expect(StyleSheet.flatten(view.getByRole('header', { name: 'Library' }).props.style).color).toBe(c.fg);
});

import { createTheme, ITheme } from '@fluentui/react';

/**
 * Compact dimensions are applied to the controls themselves. No CSS transform
 * is used, so Fluent UI layers and callouts keep the browser coordinate system.
 */
export const REQUISITION_DENSITY = 0.8;

export const compactTheme: ITheme = createTheme({
  defaultFontStyle: { fontSize: 11 },
  fonts: {
    tiny: { fontSize: 8 },
    xSmall: { fontSize: 8 },
    small: { fontSize: 10 },
    smallPlus: { fontSize: 10 },
    medium: { fontSize: 11 },
    mediumPlus: { fontSize: 13 },
    large: { fontSize: 14 },
    xLarge: { fontSize: 16 },
    xLargePlus: { fontSize: 19 },
    xxLarge: { fontSize: 22 },
    xxLargePlus: { fontSize: 26 },
    superLarge: { fontSize: 34 },
    mega: { fontSize: 54 },
  },
  spacing: {
    s2: '3px',
    s1: '6px',
    m: '13px',
    l1: '16px',
    l2: '26px',
  },
  components: {
    DefaultButton: {
      styles: {
        root: { minWidth: 64, height: 26, minHeight: 26, padding: '0 13px' },
        label: { fontSize: 11 },
      },
    },
    PrimaryButton: {
      styles: {
        root: { minWidth: 64, height: 26, minHeight: 26, padding: '0 13px' },
        label: { fontSize: 11 },
      },
    },
    IconButton: {
      styles: {
        root: { width: 26, height: 26 },
      },
    },
    TextField: {
      styles: {
        fieldGroup: { height: 26 },
        field: { fontSize: 11, padding: '0 6px' },
        subComponentStyles: {
          label: { root: { fontSize: 11, padding: '0 0 4px' } },
        },
      },
    },
    Dropdown: {
      styles: {
        title: {
          height: 26,
          lineHeight: 24,
          fontSize: 11,
          padding: '0 23px 0 6px',
        },
        caretDownWrapper: { height: 26, lineHeight: 26 },
        dropdownItem: { minHeight: 29, fontSize: 11 },
        dropdownItemSelected: { minHeight: 29, fontSize: 11 },
        label: { fontSize: 11, padding: '0 0 4px' },
      },
    },
    Dialog: {
      styles: {
        main: { minWidth: 230 },
      },
    },
    DialogContent: {
      styles: {
        header: { padding: '13px 19px 11px' },
        title: { fontSize: 16 },
        inner: { padding: '0 19px 19px' },
      },
    },
    DialogFooter: {
      styles: {
        actions: { marginTop: 13 },
      },
    },
    MessageBar: {
      styles: {
        root: { minHeight: 26, padding: '6px 10px' },
        text: { fontSize: 11 },
      },
    },
  },
});

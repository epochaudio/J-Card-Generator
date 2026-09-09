import React from 'react';
import { fontFamilyName } from '../config/textStyles.mjs';

export function StyledText({ fontFamily, children, transform, ...props }) {
  const style = typeof fontFamily === 'object' ? fontFamily.style : null;
  return <text key={style ? 'styled' : 'default'} {...props} fontFamily={fontFamilyName(fontFamily)} transform={transform}
    {...(style ? { fontWeight: style.weight, fontStyle: 'normal', style: { fontSynthesis: 'none' },
      'data-text-role': fontFamily.role, 'data-text-style': JSON.stringify(style), 'data-base-transform': transform || '' } : {})}>{children}</text>;
}
export function StyledSpan({ fontFamily, ...props }) {
  const style = typeof fontFamily === 'object' ? fontFamily.style : null;
  return <tspan {...props} fontFamily={fontFamilyName(fontFamily)} {...(style ? { fontWeight: style.weight, fontStyle: 'normal', 'data-span-weight': style.weight } : {})} />;
}

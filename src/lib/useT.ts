import { useCallback } from 'react';
import { useStore } from '../core/store/store';
import { translate, type TranslationKey } from './i18n';
import type { Locale } from '../core/types';

export function useLocale(): Locale {
  return useStore((state) => state.settings.locale);
}

/** 返回随语言切换自动更新的翻译函数 */
export function useT(): (key: TranslationKey, vars?: Record<string, string | number>) => string {
  const locale = useStore((state) => state.settings.locale);
  return useCallback(
    (key: TranslationKey, vars?: Record<string, string | number>) => translate(locale, key, vars),
    [locale],
  );
}

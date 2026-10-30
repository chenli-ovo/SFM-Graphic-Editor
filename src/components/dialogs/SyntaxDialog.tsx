import { BookOpen, X } from 'lucide-react';
import { useStore } from '../../core/store/store';
import { useT } from '../../lib/useT';
import { Modal } from '../ui/Modal';

const SYNTAX_ZH: Array<{ title: string; code: string; note?: string }> = [
  { title: '程序名（可选）', code: 'name "我的熔炼工厂"' },
  {
    title: '定时执行块',
    code: 'every 20 ticks do\n  ...\nend',
    note: 'unit 可以是 ticks 或 seconds；every 1 ticks 会每 tick 执行。',
  },
  { title: '红石脉冲块', code: 'on pulse rising do\n  ...\nend', note: 'edge: any / rising / falling。' },
  { title: '输入 / 输出', code: 'input from block(top)\ninput from tag("ores") slots 0-5\noutput to block(north, "minecraft:chest") slots 0-2' },
  { title: '条件判断', code: 'if tag("storage") has_item("minecraft:iron_ingot") then\n  output to block(bottom)\nelse\n  input from block(top)\nend' },
  {
    title: '条件类型',
    code: 'has_item("minecraft:iron_ingot")\nhas_space\nis_empty\ncount_gt 8\ncount_lt 4',
    note: '条件前加 not 取反：if tag("a") not has_item(...)。',
  },
  {
    title: '引用语法',
    code: 'block(top)\nblock(top, "minecraft:chest")\ntag("ores")',
    note: '朝向：top / bottom / north / south / east / west。',
  },
  { title: '注释', code: '# 以 # 开头，行尾注释同样有效' },
];

const SYNTAX_EN: Array<{ title: string; code: string; note?: string }> = [
  { title: 'Program name (optional)', code: 'name "My Smeltery"' },
  { title: 'Interval block', code: 'every 20 ticks do\n  ...\nend', note: 'Unit: ticks or seconds. every 1 ticks runs each tick.' },
  { title: 'Redstone pulse block', code: 'on pulse rising do\n  ...\nend', note: 'edge: any / rising / falling.' },
  { title: 'Input / Output', code: 'input from block(top)\ninput from tag("ores") slots 0-5\noutput to block(north, "minecraft:chest") slots 0-2' },
  { title: 'Condition', code: 'if tag("storage") has_item("minecraft:iron_ingot") then\n  output to block(bottom)\nelse\n  input from block(top)\nend' },
  {
    title: 'Condition kinds',
    code: 'has_item("minecraft:iron_ingot")\nhas_space\nis_empty\ncount_gt 8\ncount_lt 4',
    note: 'Prefix with not: if tag("a") not has_item(...).',
  },
  { title: 'References', code: 'block(top)\nblock(top, "minecraft:chest")\ntag("ores")', note: 'Faces: top / bottom / north / south / east / west.' },
  { title: 'Comments', code: '# starts a comment; trailing # comments work too' },
];

export function SyntaxDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const locale = useStore((state) => state.settings.locale);
  const items = locale === 'zh' ? SYNTAX_ZH : SYNTAX_EN;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('command.syntaxTitle')}
      subtitle="SFM DSL"
      icon={<BookOpen size={13} />}
      className="max-w-2xl"
      footer={
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1 rounded-md border border-line px-3 py-1 text-[10px] text-muted transition-colors hover:text-ink"
          >
            <X size={10} />
            {t('common.close')}
          </button>
        </div>
      }
    >
      <div className="space-y-2.5">
        {items.map((item) => (
          <div key={item.title} className="rounded-md border border-line bg-app/60 px-2.5 py-2">
            <p className="mb-1 text-[9px] font-semibold uppercase tracking-wider text-muted">{item.title}</p>
            <pre className="overflow-x-auto font-mono text-[10px] leading-relaxed text-ink">{item.code}</pre>
            {item.note ? <p className="mt-1 text-[9px] text-faint">{item.note}</p> : null}
          </div>
        ))}
      </div>
    </Modal>
  );
}

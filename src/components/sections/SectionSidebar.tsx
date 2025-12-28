import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { buildSectionsTree, type SectionRecord } from '@/lib/sections/tree';

async function fetchSections() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('sections')
    .select('id, title, parent_id, order_index')
    .order('order_index', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data as SectionRecord[]) ?? [];
}

function renderTree(
  nodes: ReturnType<typeof buildSectionsTree>,
  activeSectionId?: string,
  depth = 0
) {
  return nodes.map((node) => {
    const isActive = node.id === activeSectionId;
    return (
      <li key={node.id}>
        <Link
          href={`/sections/${node.id}`}
          className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm transition ${
            isActive ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'
          }`}
          style={{ marginLeft: depth * 12 }}
        >
          <span>{node.title}</span>
          {node.children.length > 0 ? (
            <span className="text-[10px] uppercase text-slate-400">
              {node.children.length}
            </span>
          ) : null}
        </Link>
        {node.children.length > 0 ? (
          <ul className="mt-1 space-y-1">
            {renderTree(node.children, activeSectionId, depth + 1)}
          </ul>
        ) : null}
      </li>
    );
  });
}

export default async function SectionSidebar({
  activeSectionId,
}: {
  activeSectionId?: string;
}) {
  const sections = await fetchSections();
  const tree = buildSectionsTree(sections);

  return (
    <aside className="hidden w-72 shrink-0 border-r border-slate-200 bg-white p-4 md:block">
      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Разделы
        </p>
      </div>
      {tree.length === 0 ? (
        <p className="text-sm text-slate-500">Разделов пока нет.</p>
      ) : (
        <ul className="space-y-1">{renderTree(tree, activeSectionId)}</ul>
      )}
    </aside>
  );
}

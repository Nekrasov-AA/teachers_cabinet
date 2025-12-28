export type SectionRecord = {
  id: string;
  title: string;
  parent_id: string | null;
  order_index: number;
};

export type SectionNode = SectionRecord & {
  children: SectionNode[];
};

export function buildSectionsTree(sections: SectionRecord[]): SectionNode[] {
  const map = new Map<string, SectionNode>();
  const roots: SectionNode[] = [];

  sections
    .sort((a, b) => a.order_index - b.order_index)
    .forEach((section) => {
      map.set(section.id, { ...section, children: [] });
    });

  map.forEach((node) => {
    if (node.parent_id) {
      const parent = map.get(node.parent_id);
      if (parent) {
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    } else {
      roots.push(node);
    }
  });

  const sortTree = (nodes: SectionNode[]) => {
    nodes.sort((a, b) => a.order_index - b.order_index);
    nodes.forEach((child) => sortTree(child.children));
  };

  sortTree(roots);
  return roots;
}

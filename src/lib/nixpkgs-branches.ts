type Edge = [string, string];

const STABLE_VERSION_RE =
  /^(?:staging|staging-next|release|nixos|nixpkgs)-(\d+\.\d+)/;

const stableEdgeTemplates: Edge[] = [
  ["staging-{v}", "staging-next-{v}"],
  ["staging-next-{v}", "release-{v}"],
  ["release-{v}", "nixos-{v}-small"],
  ["release-{v}", "nixpkgs-{v}-darwin"],
  ["nixos-{v}-small", "nixos-{v}"],
];

const unstableEdges: Edge[] = [
  ["haskell-updates", "staging"],
  ["python-updates", "staging"],
  ["staging", "staging-next"],
  ["staging-next", "master"],
  ["staging-nixos", "master"],
  ["master", "nixos-unstable-small"],
  ["master", "nixpkgs-unstable"],
  ["nixos-unstable-small", "nixos-unstable"],
];

function expandStableEdges(version: string): Edge[] {
  return stableEdgeTemplates.map(([from, to]) => [
    from.replace("{v}", version),
    to.replace("{v}", version),
  ]);
}

function buildGraph(version?: string): Record<string, string[]> {
  const graph: Record<string, string[]> = {};
  const edges: Edge[] = [
    ...unstableEdges,
    ...(version ? expandStableEdges(version) : []),
  ];

  for (const [from, to] of edges) {
    (graph[from] ??= []).push(to);
  }

  return graph;
}

export function descendants(branch: string): Set<string> {
  const version = branch.match(STABLE_VERSION_RE)?.[1];
  const graph = buildGraph(version);
  const result = new Set<string>();
  const visited = new Set<string>([branch]);
  const stack: string[] = [branch];

  while (stack.length) {
    const node = stack.pop()!;
    if (node !== branch) {
      result.add(node);
    }

    const children = graph[node] ?? [];
    for (let i = children.length - 1; i >= 0; i--) {
      if (!visited.has(children[i])) {
        visited.add(children[i]);
        stack.push(children[i]);
      }
    }
  }

  return result;
}

(function (root) {
  'use strict';
  const engine = typeof module === 'object' && module.exports ? require('@dagrejs/dagre') : root.dagre;
  const nodeWidth = 224;
  const nodeHeight = 94;

  function layoutWorkflow(skills, references) {
    const names = [...new Set(skills.map((skill) => skill.name))].sort();
    const known = new Set(names);
    const edges = [...new Map(references.filter((edge) => known.has(edge.source) && known.has(edge.target))
      .map((edge) => [JSON.stringify([edge.source, edge.target]), { source: edge.source, target: edge.target }])).values()]
      .sort((a, b) => a.source.localeCompare(b.source) || a.target.localeCompare(b.target));
    const topology = new engine.graphlib.Graph();
    names.forEach((name) => topology.setNode(name));
    edges.forEach((edge) => topology.setEdge(edge.source, edge.target));
    const components = engine.graphlib.alg.components(topology)
      .sort((a, b) => b.length - a.length || a[0].localeCompare(b[0]));
    const positions = new Map();
    const routes = new Map();
    const sections = [];
    const isolated = [];
    let top = 60;
    let width = 900;
    for (const members of components) {
      if (members.length === 1 && !topology.nodeEdges(members[0]).length) { isolated.push(members[0]); continue; }
      const memberSet = new Set(members);
      const graph = new engine.graphlib.Graph().setGraph({
        rankdir: 'LR', ranksep: 100, nodesep: 34, edgesep: 12,
        marginx: 40, marginy: 24, acyclicer: 'greedy', ranker: 'network-simplex',
      }).setDefaultEdgeLabel(() => ({}));
      members.sort().forEach((name) => graph.setNode(name, { width: nodeWidth, height: nodeHeight }));
      edges.filter((edge) => memberSet.has(edge.source)).forEach((edge) => graph.setEdge(edge.source, edge.target));
      // Dagre breaks cycles only for ranking. We use its x coordinates for
      // workflow depth, then repack each depth into compact rows so one large
      // workflow does not become a kilometer-tall canvas.
      engine.layout(graph);
      const columns = [...new Set(members.map((name) => graph.node(name).x))].sort((a, b) => a - b);
      const rows = new Map(columns.map((column) => [column, []]));
      members.forEach((name) => rows.get(graph.node(name).x).push(name));
      let componentHeight = 0;
      rows.forEach((namesInColumn, column) => {
        namesInColumn.sort((a, b) => graph.node(a).y - graph.node(b).y || a.localeCompare(b));
        componentHeight = Math.max(componentHeight, namesInColumn.length * 128);
        namesInColumn.forEach((name, row) => positions.set(name, {
          x: 40 + columns.indexOf(column) * 324,
          y: top + row * 128 + 44,
          level: columns.indexOf(column),
        }));
      });
      sections.push({ y: top - 20, columns: columns.map((x) => x - nodeWidth / 2) });
      width = Math.max(width, graph.graph().width);
      top += componentHeight + 100;
    }
    if (isolated.length) {
      sections.push({ y: top - 20, columns: [], isolated: true });
      isolated.sort().forEach((name, index) => positions.set(name, { x: 40 + index % 4 * 260, y: top + Math.floor(index / 4) * 128, level: null }));
      width = Math.max(width, 1100);
      top += Math.ceil(isolated.length / 4) * 128;
    }
    return { positions, routes, sections, width: width + 40, height: top + 40, nodeWidth, nodeHeight };
  }

  function routePath(points) {
    if (!points?.length) return '';
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length - 1; i++) {
      const p = points[i], next = points[i + 1];
      d += ` Q ${p.x} ${p.y} ${(p.x + next.x) / 2} ${(p.y + next.y) / 2}`;
    }
    const end = points.at(-1);
    return `${d} L ${end.x} ${end.y}`;
  }
  const api = { layoutWorkflow, routePath };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SkillWorkflowLayout = api;
})(typeof window === 'undefined' ? {} : window);

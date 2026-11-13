from .resource_graph import build_resource_graph


def find_attack_paths(graph, entry, target):
    """Bounded topology paths; connectivity alone does not prove an exploit."""
    adjacency = {}
    for source, destination, *_ in graph["edges"]:
        adjacency.setdefault(source, []).append(destination)
    paths = []
    def visit(node, path):
        if len(paths) >= 100 or len(path) > 9:
            return
        if node == target:
            paths.append(path)
            return
        for destination in adjacency.get(node, []):
            if destination not in path:
                visit(destination, path + [destination])
    visit(entry, [entry])
    return paths

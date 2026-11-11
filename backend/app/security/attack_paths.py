
import networkx as nx

from resource_graph import build_resource_graph


def find_attack_paths(graph, entry, target):
    try:
        paths = list(
            nx.all_simple_paths(
                graph,
                source=entry,
                target=target,
                cutoff=8
            )
        )

        return paths

    except (nx.NodeNotFound, nx.NetworkXNoPath):
        return []


if __name__ == "__main__":
    cloud_graph = build_resource_graph()

    entry_point = "INTERNET"
    target_resource = "UNKNOWN-RESOURCE"

    paths = find_attack_paths(
        cloud_graph,
        entry_point,
        target_resource
    )

    if paths:
        for index, path in enumerate(paths, 1):
            print(f"Attack Path {index}:")
            print(" -> ".join(path))
    else:
        print("No attack paths found.")

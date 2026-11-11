
import networkx as nx


def build_resource_graph():
    # Create a directed graph
    cloud_graph = nx.DiGraph()

    # Define AWS resources (nodes)
    resources = [
        ("INTERNET", "External Internet"),
        ("SG-01", "Security Group"),
        ("EC2-01", "Production EC2"),
        ("IAM-01", "IAM Role"),
        ("POLICY-01", "IAM Policy"),
        ("S3-01", "Sensitive S3 Bucket"),
    ]

    # Add resources to the graph
    for resource_id, name in resources:
        cloud_graph.add_node(
            resource_id,
            name=name
        )

    # Define relationships (edges)
    relationships = [
        ("INTERNET", "SG-01", "NETWORK_REACHABILITY"),
        ("SG-01", "EC2-01", "ALLOWS_INGRESS"),
        ("EC2-01", "IAM-01", "ASSUMES_ROLE"),
        ("IAM-01", "POLICY-01", "HAS_POLICY"),
        ("POLICY-01", "S3-01", "GRANTS_ACCESS"),
    ]

    # Add relationships to the graph
    for source, target, relation in relationships:
        cloud_graph.add_edge(
            source,
            target,
            relationship=relation
        )

    return cloud_graph


if __name__ == "__main__":
    cloud_graph = build_resource_graph()

    print("Resources:", cloud_graph.number_of_nodes())
    print("Relationships:", cloud_graph.number_of_edges())

    print("\nGraph connections:")
    for source, target, data in cloud_graph.edges(data=True):
        print(source, "->", target, data["relationship"])

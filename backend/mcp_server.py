from mcp import FastMCP

server = FastMCP("legal-mcp-server")


@server.tool()
def add(a: int, b: int) -> int:
    """Return the sum of two integers."""
    return a + b


if __name__ == "__main__":
    server.run()

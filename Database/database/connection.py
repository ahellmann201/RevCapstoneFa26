import os

import pyodbc


def get_connection() -> pyodbc.Connection:
    server = os.environ["DB_SERVER"]
    database = os.environ["DB_NAME"]
    username = os.environ["DB_USER"]
    password = os.environ["DB_PASSWORD"]

    connection_string = (
        "DRIVER={ODBC Driver 18 for SQL Server};"
        f"SERVER={server};"
        f"DATABASE={database};"
        f"UID={username};"
        f"PWD={password};"
        "Encrypt=yes;"
        "TrustServerCertificate=yes;"
    )

    return pyodbc.connect(connection_string)


# ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIJgqJ4eUHQOjwD3qf114jCPNAu/RygsM92XV481k14yU ahellmann@ycp.edu
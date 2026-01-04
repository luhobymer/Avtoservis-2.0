import java.nio.file.Files;
import java.nio.file.Paths;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.Statement;
import java.sql.SQLException;

public class SupabaseSchemaFixer {
  public static void main(String[] args) throws Exception {
    String url = System.getenv("SUPABASE_DB_URL");
    String user = System.getenv("SUPABASE_DB_USER");
    String password = System.getenv("SUPABASE_DB_PASSWORD");

    if (url == null || user == null || password == null) {
      try {
        String envText = new String(Files.readAllBytes(Paths.get(".env")), "UTF-8");
        String supaUrl = parseEnv(envText, "SUPABASE_URL");
        String dbPass = parseEnv(envText, "SUPABASE_DB_PASSWORD");
        if (supaUrl != null && dbPass != null) {
          String ref = extractRefFromUrl(supaUrl);
          url = "jdbc:postgresql://db." + ref + ".supabase.co:5432/postgres?sslmode=require";
          user = "postgres";
          password = dbPass;
        }
      } catch (Exception ignore) {}
    }
    if (url == null || user == null || password == null) {
      System.err.println("Missing DB config: SUPABASE_DB_URL/USER/PASSWORD or .env SUPABASE_URL/SUPABASE_DB_PASSWORD");
      System.exit(1);
    }
    String scriptPath = args != null && args.length > 0 ? args[0] : "tools/schema_fix.sql";
    String script = new String(Files.readAllBytes(Paths.get(scriptPath)), "UTF-8");
    try (Connection conn = DriverManager.getConnection(url, user, password)) {
      conn.setAutoCommit(false);
      executeScript(conn, script);
      conn.commit();
      System.out.println("Schema fix executed");
    }
  }

  static void executeScript(Connection conn, String script) throws SQLException {
    String[] lines = script.split("\\r?\\n");
    boolean inDo = false;
    StringBuilder buf = new StringBuilder();
    for (String line : lines) {
      String trimmed = line.trim();
      if (trimmed.isEmpty()) continue;
      if (!inDo && trimmed.startsWith("DO $$")) {
        inDo = true;
      }
      buf.append(line).append("\n");
      if (inDo) {
        if (trimmed.endsWith("$$;") || trimmed.contains("$$;")) {
          inDo = false;
          exec(conn, buf.toString());
          buf.setLength(0);
        }
      } else {
        if (trimmed.endsWith(";")) {
          exec(conn, buf.toString());
          buf.setLength(0);
        }
      }
    }
    if (buf.length() > 0) {
      exec(conn, buf.toString());
    }
  }

  static void exec(Connection conn, String sql) throws SQLException {
    try (Statement st = conn.createStatement()) {
      st.execute(sql);
    }
  }

  static String parseEnv(String content, String key) {
    for (String line : content.split("\r?\n")) {
      line = line.trim();
      if (line.startsWith("#") || line.isEmpty()) continue;
      int i = line.indexOf('=');
      if (i > 0) {
        String k = line.substring(0, i).trim();
        if (k.equals(key)) {
          return line.substring(i + 1).trim();
        }
      }
    }
    return null;
  }

  static String extractRefFromUrl(String supabaseUrl) {
    String s = supabaseUrl.replace("https://", "");
    int dot = s.indexOf('.');
    return dot > 0 ? s.substring(0, dot) : s;
  }
}

import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.io.InputStream;
import java.io.OutputStream;

public class SupabaseRpcRunner {
  public static void main(String[] args) throws Exception {
    String urlBase = System.getenv("SUPABASE_URL");
    String serviceKey = System.getenv("SUPABASE_SERVICE_KEY");
    if (urlBase == null || serviceKey == null) {
      try {
        String envText = new String(java.nio.file.Files.readAllBytes(java.nio.file.Paths.get(".env")), "UTF-8");
        String u = parseEnv(envText, "SUPABASE_URL");
        String k = parseEnv(envText, "SUPABASE_SERVICE_ROLE_KEY");
        if (u != null && k != null) {
          urlBase = u;
          serviceKey = k;
        }
      } catch (Exception ignore) {}
    }
    String fn = args != null && args.length > 0 ? args[0] : "apply_schema_fix";
    if (urlBase == null || serviceKey == null) {
      System.err.println("Missing env SUPABASE_URL/SUPABASE_SERVICE_KEY");
      System.exit(1);
    }
    String[] fnCandidates = new String[] { fn, "apply_schema_fix", "exec_sql", "execute_sql" };
    String payload = "{}";
    if (args != null && args.length > 1) {
      String second = args[1];
      String sql;
      try {
        if (second.endsWith(".sql")) {
          sql = new String(java.nio.file.Files.readAllBytes(java.nio.file.Paths.get(second)), "UTF-8");
        } else {
          sql = second;
        }
      } catch (Exception e) {
        sql = second;
      }
      String escaped = sql.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n");
      payload = "{\"sql\":\"" + escaped + "\"}";
    }
    String[] payloads = new String[] {
      payload,
      payload.replace("\"sql\":", "\"sql_query\":"),
      payload.replace("\"sql\":", "\"query\":")
    };
    int lastCode = 500;
    byte[] lastBuf = new byte[0];
    for (String fnName : fnCandidates) {
      for (String pl : payloads) {
        try {
          URL url = new URL(urlBase + "/rest/v1/rpc/" + fnName);
          HttpURLConnection conn = (HttpURLConnection) url.openConnection();
          conn.setRequestMethod("POST");
          conn.setRequestProperty("Content-Type", "application/json");
          conn.setRequestProperty("Accept", "application/json");
          conn.setRequestProperty("apikey", serviceKey);
          conn.setRequestProperty("Authorization", "Bearer " + serviceKey);
          conn.setDoOutput(true);
          byte[] body = pl.getBytes(StandardCharsets.UTF_8);
          try (OutputStream os = conn.getOutputStream()) { os.write(body); }
          int code = conn.getResponseCode();
          InputStream is = code >= 400 ? conn.getErrorStream() : conn.getInputStream();
          byte[] buf = readFully(is);
          lastCode = code;
          lastBuf = buf;
          if (code >= 200 && code < 300) {
            System.out.write(buf);
            System.exit(0);
          }
        } catch (Exception e) {
          // try next
        }
      }
    }
    System.out.write(lastBuf);
    System.exit(1);
  }

  static byte[] readFully(InputStream is) throws Exception {
    byte[] out = new byte[0];
    byte[] tmp = new byte[8192];
    int n;
    while ((n = is.read(tmp)) != -1) {
      byte[] combined = new byte[out.length + n];
      System.arraycopy(out, 0, combined, 0, out.length);
      System.arraycopy(tmp, 0, combined, out.length, n);
      out = combined;
    }
    return out;
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
}

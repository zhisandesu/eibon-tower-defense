import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;
import java.util.zip.ZipOutputStream;

/** Normalize Windows asset paths and emit a genuinely STORED resource table. */
public final class NormalizeApk {
    public static void main(String[] args) throws Exception {
        if (args.length != 2) throw new IllegalArgumentException("Source and destination APK required");
        Path source = Path.of(args[0]), destination = Path.of(args[1]);
        if (source.toAbsolutePath().normalize().equals(destination.toAbsolutePath().normalize())) {
            throw new IllegalArgumentException("Source and destination must differ");
        }
        Set<String> names = new HashSet<>();
        boolean resourceTable = false;
        try (ZipFile input = new ZipFile(source.toFile());
             ZipOutputStream output = new ZipOutputStream(Files.newOutputStream(destination))) {
            var entries = input.entries();
            while (entries.hasMoreElements()) {
                ZipEntry entry = entries.nextElement();
                String name = entry.getName().replace('\\', '/');
                if (!names.add(name)) throw new IllegalArgumentException("Duplicate APK entry: " + name);
                ZipEntry copy = new ZipEntry(name);
                copy.setTimeLocal(LocalDateTime.of(1980, 1, 1, 0, 0));
                boolean stored = name.equals("resources.arsc") || entry.getMethod() == ZipEntry.STORED;
                if (name.equals("resources.arsc")) resourceTable = true;
                // .NET Framework NoCompression still emits DEFLATED (method 8).
                // Android 11+ requires resources.arsc to use STORED (method 0).
                copy.setMethod(stored ? ZipEntry.STORED : ZipEntry.DEFLATED);
                if (stored) {
                    copy.setSize(entry.getSize());
                    copy.setCompressedSize(entry.getSize());
                    copy.setCrc(entry.getCrc());
                }
                output.putNextEntry(copy);
                try (InputStream data = input.getInputStream(entry)) { data.transferTo(output); }
                output.closeEntry();
            }
        }
        if (!resourceTable) throw new IllegalArgumentException("Missing resources.arsc");
    }
}

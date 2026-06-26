package xyz.w1701701.android;

import android.Manifest;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.util.Locale;

@CapacitorPlugin(
    name = "ShareCardSaver",
    permissions = {
        @Permission(strings = { Manifest.permission.WRITE_EXTERNAL_STORAGE }, alias = "storage")
    }
)
public class ShareCardSaverPlugin extends Plugin {
    private static final String STORAGE_PERMISSION_ALIAS = "storage";
    private static final String DEFAULT_FILE_NAME = "1701701-share-card.png";
    private static final String ALBUM_DIRECTORY_NAME = "1701701";

    @PluginMethod
    public void saveToAlbum(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q && getPermissionState(STORAGE_PERMISSION_ALIAS) != PermissionState.GRANTED) {
            requestPermissionForAlias(STORAGE_PERMISSION_ALIAS, call, "saveToAlbumPermissionCallback");
            return;
        }

        saveImage(call);
    }

    @PermissionCallback
    private void saveToAlbumPermissionCallback(PluginCall call) {
        if (call == null) return;
        if (getPermissionState(STORAGE_PERMISSION_ALIAS) != PermissionState.GRANTED) {
            call.reject("Storage permission denied");
            return;
        }

        saveImage(call);
    }

    private void saveImage(PluginCall call) {
        Uri savedUri = null;
        try {
            DecodedImage decodedImage = decodeDataUrl(call.getString("dataUrl"));
            String filename = sanitizeFilename(call.getString("filename"), decodedImage.extension);
            savedUri = writeImage(decodedImage, filename);

            JSObject result = new JSObject();
            result.put("uri", savedUri.toString());
            result.put("filename", filename);
            call.resolve(result);
        } catch (Exception error) {
            if (savedUri != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                getContext().getContentResolver().delete(savedUri, null, null);
            }
            call.reject("Failed to save share card", error);
        }
    }

    private DecodedImage decodeDataUrl(String dataUrl) throws IOException {
        if (dataUrl == null || dataUrl.trim().isEmpty()) {
            throw new IOException("Missing image data");
        }

        int commaIndex = dataUrl.indexOf(',');
        if (commaIndex <= 0) {
            throw new IOException("Invalid image data");
        }

        String metadata = dataUrl.substring(0, commaIndex).toLowerCase(Locale.ROOT);
        if (!metadata.startsWith("data:image/") || !metadata.contains(";base64")) {
            throw new IOException("Unsupported image data");
        }

        String mimeType = metadata.substring("data:".length(), metadata.indexOf(';'));
        byte[] bytes = Base64.decode(dataUrl.substring(commaIndex + 1), Base64.DEFAULT);
        if (bytes.length == 0) {
            throw new IOException("Empty image data");
        }

        return new DecodedImage(mimeType, bytes, extensionForMimeType(mimeType));
    }

    private Uri writeImage(DecodedImage decodedImage, String filename) throws IOException {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            return writeImageWithScopedStorage(decodedImage, filename);
        }

        return writeImageToPublicPictures(decodedImage, filename);
    }

    private Uri writeImageWithScopedStorage(DecodedImage decodedImage, String filename) throws IOException {
        ContentResolver resolver = getContext().getContentResolver();
        ContentValues values = new ContentValues();
        values.put(MediaStore.Images.Media.DISPLAY_NAME, filename);
        values.put(MediaStore.Images.Media.MIME_TYPE, decodedImage.mimeType);
        values.put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + File.separator + ALBUM_DIRECTORY_NAME);
        values.put(MediaStore.Images.Media.IS_PENDING, 1);

        Uri collection = MediaStore.Images.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY);
        Uri uri = resolver.insert(collection, values);
        if (uri == null) {
            throw new IOException("Unable to create media item");
        }

        try {
            writeBytes(resolver, uri, decodedImage.bytes);
            ContentValues completedValues = new ContentValues();
            completedValues.put(MediaStore.Images.Media.IS_PENDING, 0);
            resolver.update(uri, completedValues, null, null);
            return uri;
        } catch (IOException error) {
            resolver.delete(uri, null, null);
            throw error;
        }
    }

    private Uri writeImageToPublicPictures(DecodedImage decodedImage, String filename) throws IOException {
        File picturesDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES);
        File albumDir = new File(picturesDir, ALBUM_DIRECTORY_NAME);
        if (!albumDir.exists() && !albumDir.mkdirs()) {
            throw new IOException("Unable to create album directory");
        }

        File imageFile = createUniqueFile(albumDir, filename);
        try (FileOutputStream outputStream = new FileOutputStream(imageFile)) {
            outputStream.write(decodedImage.bytes);
        }

        ContentValues values = new ContentValues();
        values.put(MediaStore.Images.Media.DATA, imageFile.getAbsolutePath());
        values.put(MediaStore.Images.Media.DISPLAY_NAME, imageFile.getName());
        values.put(MediaStore.Images.Media.MIME_TYPE, decodedImage.mimeType);
        values.put(MediaStore.Images.Media.DATE_ADDED, System.currentTimeMillis() / 1000);
        values.put(MediaStore.Images.Media.DATE_TAKEN, System.currentTimeMillis());

        Uri insertedUri = getContext().getContentResolver().insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values);
        return insertedUri != null ? insertedUri : Uri.fromFile(imageFile);
    }

    private void writeBytes(ContentResolver resolver, Uri uri, byte[] bytes) throws IOException {
        try (OutputStream outputStream = resolver.openOutputStream(uri)) {
            if (outputStream == null) {
                throw new IOException("Unable to open output stream");
            }
            outputStream.write(bytes);
        }
    }

    private File createUniqueFile(File directory, String filename) {
        File target = new File(directory, filename);
        if (!target.exists()) {
            return target;
        }

        String baseName = filename;
        String extension = "";
        int dotIndex = filename.lastIndexOf('.');
        if (dotIndex > 0) {
            baseName = filename.substring(0, dotIndex);
            extension = filename.substring(dotIndex);
        }

        int index = 1;
        do {
            target = new File(directory, baseName + "-" + index + extension);
            index += 1;
        } while (target.exists());

        return target;
    }

    private String sanitizeFilename(String filename, String extension) {
        String safeFilename = filename == null ? "" : filename.trim();
        safeFilename = safeFilename.replaceAll("[\\\\/:*?\"<>|\\r\\n]+", "-");
        if (safeFilename.isEmpty()) {
            safeFilename = DEFAULT_FILE_NAME;
        }

        String lowerFilename = safeFilename.toLowerCase(Locale.ROOT);
        if (
            !lowerFilename.endsWith(".png")
                && !lowerFilename.endsWith(".jpg")
                && !lowerFilename.endsWith(".jpeg")
                && !lowerFilename.endsWith(".webp")
        ) {
            safeFilename += extension;
        }

        return safeFilename;
    }

    private String extensionForMimeType(String mimeType) {
        switch (mimeType) {
            case "image/jpeg":
            case "image/jpg":
                return ".jpg";
            case "image/webp":
                return ".webp";
            case "image/png":
            default:
                return ".png";
        }
    }

    private static class DecodedImage {
        private final String mimeType;
        private final byte[] bytes;
        private final String extension;

        DecodedImage(String mimeType, byte[] bytes, String extension) {
            this.mimeType = mimeType;
            this.bytes = bytes;
            this.extension = extension;
        }
    }
}

/** Select a supported photo, or pass an unsupported image on to the decoder for its reason. */
export function pickPhotoFile(files: Iterable<File> | ArrayLike<File>): File | null {
  const candidates = Array.from(files);
  const supported = candidates.find(
    (file) => /^(image\/jpeg|image\/png)$/i.test(file.type) || /\.(jpe?g|png)$/i.test(file.name),
  );
  const selected =
    supported ??
    candidates.find((file) => /^image\//i.test(file.type) || /\.(heic|heif)$/i.test(file.name));
  if (!selected) return null;
  return selected.name ? selected : new File([selected], 'foto.png', { type: selected.type });
}

// ---- Types ----
type FileLink = { url: string; title?: string; type?: string };
type MaterialFile = {
  filename: string;
  url: string;
  mimetype: string;
  size?: number;
};
type Material = {
  _id: string;
  content: string;
  files: MaterialFile[];
  links: FileLink[];
  postedBy: { username: string };
  createdAt: string;
  [key: string]: any; // allow extra
};
type MaterialFormProps = {
  onSubmit: (form: FormData) => void;
  initial?: Partial<Material> & { courseInstance?: string };
  onCancel?: () => void;
};
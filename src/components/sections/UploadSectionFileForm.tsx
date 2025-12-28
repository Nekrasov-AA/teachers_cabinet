"use client";

import { ChangeEvent, useId, useState } from "react";

type UploadSectionFileFormProps = {
  uploadAction: (formData: FormData) => Promise<void>;
};

export default function UploadSectionFileForm({ uploadAction }: UploadSectionFileFormProps) {
  const inputId = useId();
  const [fileName, setFileName] = useState<string | null>(null);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setFileName(file ? file.name : null);
  }

  return (
    <form
      className="mt-4 flex flex-col gap-4 rounded-xl border border-dashed border-slate-300 p-4"
      encType="multipart/form-data"
    >
      <label
        htmlFor={inputId}
        className="flex cursor-pointer flex-col rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 transition hover:bg-slate-100"
      >
        <span className="font-medium">{fileName ?? "Выбрать файл"}</span>
        <span className="text-xs text-slate-500">
          {fileName ? "Нажмите, чтобы выбрать другой файл" : "Поддерживаются PDF, изображения и архивы"}
        </span>
      </label>
      <input
        id={inputId}
        type="file"
        name="file"
        required
        className="sr-only"
        onChange={handleFileChange}
      />
      <p className="text-xs text-slate-500">
        {fileName ? `Выбрано: ${fileName}` : "После выбора файла нажмите «Загрузить»."}
      </p>
      <button
        type="submit"
        formAction={uploadAction}
        className="self-start rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
      >
        Загрузить
      </button>
    </form>
  );
}

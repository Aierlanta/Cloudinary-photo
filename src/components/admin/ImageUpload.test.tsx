import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { Group, ImageUrlImportResponse } from "@/types";

const successMock = jest.fn();
const errorMock = jest.fn();

let translations: any;

// Mock toast hook，避免真实渲染 Toast，并捕获成功/失败提示
jest.mock("@/hooks/useToast", () => ({
  useToast: () => ({
    toasts: [],
    addToast: jest.fn(),
    removeToast: jest.fn(),
    clearAllToasts: jest.fn(),
    success: successMock,
    error: errorMock,
    warning: jest.fn(),
    info: jest.fn(),
  }),
}));

// Mock 多语言上下文，固定使用 zh 文案，避免依赖真实 Context
jest.mock("@/hooks/useLocale", () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { zh } = require("@/i18n/locales/zh");
  translations = zh;
  return {
    useLocale: () => ({
      locale: "zh",
      t: zh,
      changeLocale: jest.fn(),
      toggleLocale: jest.fn(),
    }),
  };
});

// 延迟加载组件，确保上面的 mock 已生效
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ImageUpload = require("@/components/admin/ImageUpload")
  .default as typeof import("@/components/admin/ImageUpload").default;

function createJsonResponse(data: any, ok = true, status = 200): Response {
  return {
    ok,
    status,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    json: jest.fn().mockResolvedValue(data),
  } as unknown as Response;
}

// 为测试准备一个固定的分组数据，模拟后端返回的分组列表
const groups: Group[] = [
  {
    id: "grp_test",
    name: "测试分组",
    description: "仅用于测试的分组",
    createdAt: new Date("2024-01-01T00:00:00.000Z"),
    imageCount: 0,
  },
];

describe("ImageUpload 自定义外链导入 - 前后端联动", () => {
  const originalFetch = global.fetch as typeof fetch | undefined;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    // 还原全局 fetch，避免影响其他测试
    global.fetch = originalFetch as any;
  });

  it("TXT 模式下点击“导入 URL”会向后端发送正确 payload 并处理成功结果", async () => {
    const urlsText = [
      "https://example.com/image1.jpg",
      "https://example.com/image2.png",
    ].join("\n");

    const providersResponse = {
      data: {
        providers: [
          {
            id: "cloudinary",
            name: "Cloudinary",
            description: "Cloudinary",
            isAvailable: true,
            features: [],
          },
          {
            id: "custom",
            name: "自定义外链",
            description: "自定义外链",
            isAvailable: true,
            features: [],
          },
        ],
      },
    };

    const importResult: ImageUrlImportResponse = {
      total: 2,
      success: 2,
      failed: 0,
      errors: [],
    };

    const fetchMock = jest.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input.toString();

        if (url === "/api/admin/storage/providers") {
          return createJsonResponse(providersResponse);
        }

        if (url === "/api/admin/images/import-urls") {
          const body =
            init && typeof init.body === "string"
              ? JSON.parse(init.body)
              : null;

          expect(body).toEqual({
            provider: "custom",
            groupId: groups[0].id,
            mode: "txt",
            content: urlsText,
          });

          return createJsonResponse({ data: importResult });
        }

        throw new Error(`Unexpected fetch url: ${url}`);
      }
    ) as jest.Mock;

    global.fetch = fetchMock as any;

    const onUploadSuccess = jest.fn();

    render(<ImageUpload groups={groups} onUploadSuccess={onUploadSuccess} />);

    await waitFor(() => {
      const selects = screen.getAllByRole("combobox");
      expect(selects.length).toBeGreaterThan(1);
    });
    const selects = screen.getAllByRole("combobox") as HTMLSelectElement[];
    const provider = selects.find((select) =>
      Array.from(select.options).some((opt) => opt.value === "custom")
    );
    expect(provider).toBeDefined();

    // 选择自定义图床 provider（包含 custom 选项的那个下拉框）
    const providerSelect = selects.find((select) =>
      Array.from(select.options).some((opt) => opt.value === "custom")
    ) as HTMLSelectElement;
    fireEvent.change(providerSelect, { target: { value: "custom" } });

    // 选择分组（其余的下拉框）
    const groupSelect = selects.find(
      (select) => select !== providerSelect
    ) as HTMLSelectElement;
    fireEvent.change(groupSelect, { target: { value: groups[0].id } });

    // 填写 TXT 内容
    const txtPlaceholder: string =
      translations.adminImages.urlImportTxtPlaceholder;
    const textarea = screen.getByPlaceholderText(
      txtPlaceholder
    ) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: urlsText } });

    // 点击“导入 URL”按钮
    const importButtonLabel: string = translations.adminImages.urlImportButton;
    const importButton = screen.getByRole("button", {
      name: importButtonLabel,
    });
    fireEvent.click(importButton);

    // 等待导入请求发送
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/images/import-urls",
        expect.objectContaining({
          method: "POST",
        })
      );
    });

    // 成功 toast 被调用
    expect(successMock).toHaveBeenCalledTimes(1);
    // onUploadSuccess 回调被调用
    expect(onUploadSuccess).toHaveBeenCalledTimes(1);
  });

  it("JSON 模式下携带 width/height 时会透传给后端", async () => {
    const jsonText =
      '[{"url":"https://example.com/image1.jpg","width":800,"height":600}]';

    const providersResponse = {
      data: {
        providers: [
          {
            id: "cloudinary",
            name: "Cloudinary",
            description: "Cloudinary",
            isAvailable: true,
            features: [],
          },
          {
            id: "custom",
            name: "自定义外链",
            description: "自定义外链",
            isAvailable: true,
            features: [],
          },
        ],
      },
    };

    const importResult: ImageUrlImportResponse = {
      total: 1,
      success: 1,
      failed: 0,
      errors: [],
    };

    const fetchMock = jest.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input.toString();

        if (url === "/api/admin/storage/providers") {
          return createJsonResponse(providersResponse);
        }

        if (url === "/api/admin/images/import-urls") {
          const body =
            init && typeof init.body === "string"
              ? JSON.parse(init.body)
              : null;

          expect(body).toEqual({
            provider: "custom",
            groupId: groups[0].id,
            mode: "json",
            content: jsonText,
          });

          return createJsonResponse({ data: importResult });
        }

        throw new Error(`Unexpected fetch url: ${url}`);
      }
    ) as jest.Mock;

    global.fetch = fetchMock as any;

    const onUploadSuccess = jest.fn();

    render(<ImageUpload groups={groups} onUploadSuccess={onUploadSuccess} />);

    await waitFor(() => {
      const selects = screen.getAllByRole("combobox");
      expect(selects.length).toBeGreaterThan(1);
    });
    const selects = screen.getAllByRole("combobox") as HTMLSelectElement[];
    const provider = selects.find((select) =>
      Array.from(select.options).some((opt) => opt.value === "custom")
    );
    expect(provider).toBeDefined();

    // 选择自定义图床 provider（包含 custom 选项的那个下拉框）
    const providerSelect = selects.find((select) =>
      Array.from(select.options).some((opt) => opt.value === "custom")
    ) as HTMLSelectElement;
    fireEvent.change(providerSelect, { target: { value: "custom" } });

    // 选择分组（其余的下拉框）
    const groupSelect = selects.find(
      (select) => select !== providerSelect
    ) as HTMLSelectElement;
    fireEvent.change(groupSelect, { target: { value: groups[0].id } });

    // 切换到 JSON 模式
    const jsonModeBtn = screen.getByRole("button", {
      name: translations.adminImages.urlImportModeJson,
    });
    fireEvent.click(jsonModeBtn);

    // 填写 JSON 内容
    const jsonPlaceholder: string = translations.adminImages.urlImportJsonPlaceholder;
    const textarea = screen.getByPlaceholderText(
      jsonPlaceholder
    ) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: jsonText } });

    // 点击“导入 URL”按钮
    const importButtonLabel: string = translations.adminImages.urlImportButton;
    const importButton = screen.getByRole("button", {
      name: importButtonLabel,
    });
    fireEvent.click(importButton);

    // 等待导入请求发送
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/images/import-urls",
        expect.objectContaining({
          method: "POST",
        })
      );
    });

    expect(successMock).toHaveBeenCalledTimes(1);
    expect(onUploadSuccess).toHaveBeenCalledTimes(1);
  });

  it("后端返回错误时会展示错误 toast 并不会调用 onUploadSuccess", async () => {
    const urlsText = "https://example.com/image1.jpg";
    const serverErrorMessage = "模拟导入失败";

    const providersResponse = {
      data: {
        providers: [
          {
            id: "cloudinary",
            name: "Cloudinary",
            description: "Cloudinary",
            isAvailable: true,
            features: [],
          },
          {
            id: "custom",
            name: "自定义外链",
            description: "自定义外链",
            isAvailable: true,
            features: [],
          },
        ],
      },
    };

    const fetchMock = jest.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url === "/api/admin/storage/providers") {
        return createJsonResponse(providersResponse);
      }

      if (url === "/api/admin/images/import-urls") {
        return createJsonResponse(
          { error: { message: serverErrorMessage } },
          false,
          400
        );
      }

      throw new Error(`Unexpected fetch url: ${url}`);
    }) as jest.Mock;

    global.fetch = fetchMock as any;

    const onUploadSuccess = jest.fn();

    render(<ImageUpload groups={groups} onUploadSuccess={onUploadSuccess} />);

    await waitFor(() => {
      const selects = screen.getAllByRole("combobox");
      expect(selects.length).toBeGreaterThan(1);
    });
    const selects = screen.getAllByRole("combobox") as HTMLSelectElement[];
    const provider = selects.find((select) =>
      Array.from(select.options).some((opt) => opt.value === "custom")
    );
    expect(provider).toBeDefined();

    const providerSelect = selects.find((select) =>
      Array.from(select.options).some((opt) => opt.value === "custom")
    ) as HTMLSelectElement;
    fireEvent.change(providerSelect, { target: { value: "custom" } });

    // 填写 TXT 内容
    const txtPlaceholder: string =
      translations.adminImages.urlImportTxtPlaceholder;
    const textarea = screen.getByPlaceholderText(
      txtPlaceholder
    ) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: urlsText } });

    // 点击“导入 URL”按钮
    const importButtonLabel: string = translations.adminImages.urlImportButton;
    const importButton = screen.getByRole("button", {
      name: importButtonLabel,
    });
    fireEvent.click(importButton);

    // 应该调用错误 toast
    await waitFor(() => {
      expect(errorMock).toHaveBeenCalled();
    });

    const lastErrorCall = errorMock.mock.calls[errorMock.mock.calls.length - 1];
    expect(lastErrorCall[1]).toBe(serverErrorMessage);

    // onUploadSuccess 不会被调用
    expect(onUploadSuccess).not.toHaveBeenCalled();
  });
});

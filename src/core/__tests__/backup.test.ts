import { describe, expect, it } from "vitest";
import { describeColumns } from "@/core/backup";
import { organizationModuleSettings } from "@/db/schema/tenancy";

describe("describeColumns", () => {
  it("descreve as colunas de uma tabela Drizzle", () => {
    const columns = describeColumns(organizationModuleSettings);
    const byName = Object.fromEntries(columns.map((c) => [c.name, c]));

    expect(byName.organization_id).toBeDefined();
    expect(byName.organization_id.notNull).toBe(true);
    expect(byName.enabled.notNull).toBe(true);
  });
});

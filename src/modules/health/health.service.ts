export type DatabaseCheck = () => Promise<void>;

type HealthBody = {
  status: "ok" | "degraded";
  services: {
    database: "up" | "down";
  };
  checkedAt: string;
};

export type HealthResult = {
  body: HealthBody;
  httpStatus: 200 | 503;
};

export async function getHealthStatus(
  checkDatabase: DatabaseCheck,
): Promise<HealthResult> {
  const checkedAt = new Date().toISOString();

  try {
    await checkDatabase();

    return {
      body: {
        status: "ok",
        services: { database: "up" },
        checkedAt,
      },
      httpStatus: 200,
    };
  } catch {
    return {
      body: {
        status: "degraded",
        services: { database: "down" },
        checkedAt,
      },
      httpStatus: 503,
    };
  }
}

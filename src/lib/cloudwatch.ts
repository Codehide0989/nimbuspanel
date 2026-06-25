import {
  CloudWatchClient,
  GetMetricStatisticsCommand,
} from "@aws-sdk/client-cloudwatch";

export interface MetricDataPoint {
  timestamp: Date;
  value: number;
}

export interface InstanceMetrics {
  cpu: MetricDataPoint[];
  networkIn: MetricDataPoint[];
  networkOut: MetricDataPoint[];
  statusCheckFailed: MetricDataPoint[];
}

function createClient(region: string, accessKeyId: string, secretAccessKey: string): CloudWatchClient {
  return new CloudWatchClient({
    region,
    credentials: { accessKeyId, secretAccessKey },
  });
}

async function getMetric(
  client: CloudWatchClient,
  instanceId: string,
  metricName: string,
  namespace: string = "AWS/EC2",
  stat: string = "Average",
  periodMinutes: number = 5
): Promise<MetricDataPoint[]> {
  const endTime = new Date();
  const startTime = new Date(endTime.getTime() - 60 * 60 * 1000); // Last 1 hour

  const response = await client.send(
    new GetMetricStatisticsCommand({
      Namespace: namespace,
      MetricName: metricName,
      Dimensions: [{ Name: "InstanceId", Value: instanceId }],
      StartTime: startTime,
      EndTime: endTime,
      Period: periodMinutes * 60,
      Statistics: [stat as "Average" | "Sum" | "Maximum" | "Minimum" | "SampleCount"],
    })
  );

  return (response.Datapoints ?? [])
    .sort((a, b) => (a.Timestamp?.getTime() ?? 0) - (b.Timestamp?.getTime() ?? 0))
    .map((dp) => ({
      timestamp: dp.Timestamp ?? new Date(),
      value: (dp.Average ?? dp.Sum ?? dp.Maximum ?? 0) as number,
    }));
}

export async function getInstanceMetrics(
  instanceId: string,
  region: string,
  accessKeyId: string,
  secretAccessKey: string
): Promise<InstanceMetrics> {
  const client = createClient(region, accessKeyId, secretAccessKey);

  const [cpu, networkIn, networkOut, statusCheck] = await Promise.all([
    getMetric(client, instanceId, "CPUUtilization"),
    getMetric(client, instanceId, "NetworkIn", "AWS/EC2", "Sum"),
    getMetric(client, instanceId, "NetworkOut", "AWS/EC2", "Sum"),
    getMetric(client, instanceId, "StatusCheckFailed", "AWS/EC2", "Maximum"),
  ]);

  return { cpu, networkIn, networkOut, statusCheckFailed: statusCheck };
}

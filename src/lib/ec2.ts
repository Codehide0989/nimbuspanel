import {
  EC2Client,
  DescribeInstancesCommand,
  StartInstancesCommand,
  StopInstancesCommand,
  RebootInstancesCommand,
  TerminateInstancesCommand,
  type Instance,
} from "@aws-sdk/client-ec2";

export interface EC2InstanceInfo {
  instanceId: string;
  instanceType: string;
  status: string;
  publicIp: string | null;
  privateIp: string | null;
  region: string;
  availabilityZone: string | null;
  platform: string | null;
  amiId: string | null;
  launchTime: Date | null;
  keyName: string | null;
  securityGroups: { id: string; name: string }[];
  tags: Record<string, string>;
}

function createClient(region: string, accessKeyId: string, secretAccessKey: string): EC2Client {
  return new EC2Client({
    region,
    credentials: { accessKeyId, secretAccessKey },
  });
}

function mapInstance(instance: Instance, region: string): EC2InstanceInfo {
  const tags: Record<string, string> = {};
  instance.Tags?.forEach((tag) => {
    if (tag.Key && tag.Value) tags[tag.Key] = tag.Value;
  });

  return {
    instanceId: instance.InstanceId ?? "",
    instanceType: instance.InstanceType ?? "unknown",
    status: instance.State?.Name ?? "unknown",
    publicIp: instance.PublicIpAddress ?? null,
    privateIp: instance.PrivateIpAddress ?? null,
    region,
    availabilityZone: instance.Placement?.AvailabilityZone ?? null,
    platform: instance.PlatformDetails ?? null,
    amiId: instance.ImageId ?? null,
    launchTime: instance.LaunchTime ?? null,
    keyName: instance.KeyName ?? null,
    securityGroups: (instance.SecurityGroups ?? []).map((sg) => ({
      id: sg.GroupId ?? "",
      name: sg.GroupName ?? "",
    })),
    tags,
  };
}

/**
 * Discover all EC2 instances in a region.
 */
export async function discoverInstances(
  region: string,
  accessKeyId: string,
  secretAccessKey: string
): Promise<EC2InstanceInfo[]> {
  const client = createClient(region, accessKeyId, secretAccessKey);
  const instances: EC2InstanceInfo[] = [];
  let nextToken: string | undefined;

  do {
    const response = await client.send(
      new DescribeInstancesCommand({ NextToken: nextToken })
    );
    response.Reservations?.forEach((reservation) => {
      reservation.Instances?.forEach((instance) => {
        // Skip terminated instances
        if (instance.State?.Name !== "terminated") {
          instances.push(mapInstance(instance, region));
        }
      });
    });
    nextToken = response.NextToken;
  } while (nextToken);

  return instances;
}

/**
 * Get status of a single instance.
 */
export async function getInstanceStatus(
  instanceId: string,
  region: string,
  accessKeyId: string,
  secretAccessKey: string
): Promise<EC2InstanceInfo | null> {
  const client = createClient(region, accessKeyId, secretAccessKey);
  const response = await client.send(
    new DescribeInstancesCommand({ InstanceIds: [instanceId] })
  );
  const instance = response.Reservations?.[0]?.Instances?.[0];
  if (!instance) return null;
  return mapInstance(instance, region);
}

export async function startInstance(instanceId: string, region: string, accessKeyId: string, secretAccessKey: string): Promise<void> {
  const client = createClient(region, accessKeyId, secretAccessKey);
  await client.send(new StartInstancesCommand({ InstanceIds: [instanceId] }));
}

export async function stopInstance(instanceId: string, region: string, accessKeyId: string, secretAccessKey: string): Promise<void> {
  const client = createClient(region, accessKeyId, secretAccessKey);
  await client.send(new StopInstancesCommand({ InstanceIds: [instanceId] }));
}

export async function rebootInstance(instanceId: string, region: string, accessKeyId: string, secretAccessKey: string): Promise<void> {
  const client = createClient(region, accessKeyId, secretAccessKey);
  await client.send(new RebootInstancesCommand({ InstanceIds: [instanceId] }));
}

export async function terminateInstance(instanceId: string, region: string, accessKeyId: string, secretAccessKey: string): Promise<void> {
  const client = createClient(region, accessKeyId, secretAccessKey);
  await client.send(new TerminateInstancesCommand({ InstanceIds: [instanceId] }));
}

/**
 * Validate AWS credentials by attempting DescribeInstances.
 */
export async function validateCredentials(region: string, accessKeyId: string, secretAccessKey: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const client = createClient(region, accessKeyId, secretAccessKey);
    await client.send(new DescribeInstancesCommand({ MaxResults: 5 }));
    return { valid: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Validation failed";
    return { valid: false, error: msg };
  }
}

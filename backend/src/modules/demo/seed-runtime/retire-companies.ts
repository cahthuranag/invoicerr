import { Logger } from '@nestjs/common';

import { sessionCache } from '@/lib/session-cache';
import { deleteArchivedArtifacts } from '@/modules/documents/archive/storage';
import { deleteInboundFilesForCompany } from '@/modules/documents/received-invoices/storage';
import prisma from '@/prisma/prisma.service';

const logger = new Logger('demo-retire-companies');

/** Deletes the demo account's previous companies, files first: an archive path names no company. */
export async function retireDemoCompanies(userId: string, companyIds: readonly string[]): Promise<void> {
  for (const companyId of companyIds) await eraseCompanyFiles(companyId);
  if (companyIds.length > 0) {
    await prisma.company.deleteMany({ where: { id: { in: [...companyIds] } } });
  }
  await sessionCache.invalidateUsers([userId]);
}

async function eraseCompanyFiles(companyId: string): Promise<void> {
  const archives = await prisma.documentArchive.findMany({ where: { companyId }, select: { uri: true } });
  for (const archive of archives) {
    try {
      await deleteArchivedArtifacts(archive.uri);
    } catch (error) {
      logger.warn(`Could not erase archived artifact ${archive.uri} for company ${companyId}: ${error}`);
    }
  }
  try {
    await deleteInboundFilesForCompany(companyId);
  } catch (error) {
    logger.warn(`Could not erase inbound files for company ${companyId}: ${error}`);
  }
}

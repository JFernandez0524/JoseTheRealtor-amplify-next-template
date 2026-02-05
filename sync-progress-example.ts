// Add this to your syncToGHL function for better user feedback

export async function syncToGHL(leadIds: string[], onProgress?: (current: number, total: number) => void): Promise<{ successful: number; failed: number; isAsync?: boolean }> {
  try {
    const BATCH_SIZE = 10;
    const DELAY_MS = 2000;
    
    let successful = 0;
    let failed = 0;
    
    console.log(`🔄 Syncing ${leadIds.length} leads in batches of ${BATCH_SIZE}...`);
    
    // Process leads in batches
    for (let i = 0; i < leadIds.length; i += BATCH_SIZE) {
      const batch = leadIds.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(leadIds.length / BATCH_SIZE);
      
      console.log(`📦 Processing batch ${batchNum}/${totalBatches} (${batch.length} leads)`);
      
      // Call progress callback if provided
      if (onProgress) {
        onProgress(i + batch.length, leadIds.length);
      }
      
      const results = await Promise.allSettled(
        batch.map((id) => client.mutations.manualGhlSync({ leadId: id }))
      );
      
      // ... rest of your existing logic
    }
    
    return { successful, failed };
  } catch (err) {
    console.error('Failed to sync leads:', err);
    throw err;
  }
}

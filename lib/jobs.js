// In-memory job tracking system
const jobs = new Map();

const JOB_STATUS = {
  QUEUED: 'queued',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed'
};

class JobManager {
  static createJob(jobId, videoUrl) {
    const job = {
      id: jobId,
      videoUrl,
      status: JOB_STATUS.QUEUED,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      audioUrl: null,
      error: null,
      progress: 0
    };
    
    jobs.set(jobId, job);
    return job;
  }

  static getJob(jobId) {
    return jobs.get(jobId);
  }

  static updateJob(jobId, updates) {
    const job = jobs.get(jobId);
    if (!job) {
      return null;
    }

    const updatedJob = {
      ...job,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    jobs.set(jobId, updatedJob);
    return updatedJob;
  }

  static setJobStatus(jobId, status, error = null) {
    return this.updateJob(jobId, { status, error });
  }

  static setJobProgress(jobId, progress) {
    return this.updateJob(jobId, { progress });
  }

  static setJobCompleted(jobId, audioUrl) {
    return this.updateJob(jobId, { 
      status: JOB_STATUS.COMPLETED, 
      audioUrl,
      progress: 100 
    });
  }

  static setJobFailed(jobId, error) {
    return this.updateJob(jobId, { 
      status: JOB_STATUS.FAILED, 
      error: error.message || error,
      progress: 0 
    });
  }

  static getAllJobs() {
    return Array.from(jobs.values());
  }

  static deleteJob(jobId) {
    return jobs.delete(jobId);
  }

  static cleanup(maxAge = 24 * 60 * 60 * 1000) { // 24 hours default
    const now = new Date();
    const jobsToDelete = [];

    for (const [jobId, job] of jobs.entries()) {
      const jobAge = now - new Date(job.createdAt);
      if (jobAge > maxAge) {
        jobsToDelete.push(jobId);
      }
    }

    jobsToDelete.forEach(jobId => jobs.delete(jobId));
    return jobsToDelete.length;
  }
}

export {
  JobManager,
  JOB_STATUS
};

/*
 * Audit Trail Chaincode for AEGIS
 * Stores immutable audit events on Hyperledger Fabric blockchain
 */

const { Contract } = require('fabric-contract-api');

class AuditTrailContract extends Contract {
    constructor() {
        super('AuditTrailContract');
    }

    /**
     * Initialize the chaincode
     */
    async Init(ctx) {
        console.info('Audit Trail Chaincode initialized');
        return { status: 'success', message: 'Audit Trail Chaincode initialized' };
    }

    /**
     * Create a new audit event
     * @param {Context} ctx - Transaction context
     * @param {string} eventId - Unique event ID
     * @param {string} eventType - Type of event
     * @param {string} officerId - ID of the officer who performed the action
     * @param {string} timestamp - ISO timestamp
     * @param {string} alertId - Optional alert ID
     * @param {string} complaintId - Optional complaint ID
     * @param {string} actionType - Optional action type
     * @param {string} metadata - JSON string of metadata
     */
    async CreateAuditEvent(ctx, eventId, eventType, officerId, timestamp, alertId, complaintId, actionType, metadata) {
        // Validate required fields
        if (!eventId || !eventType || !officerId || !timestamp) {
            throw new Error('Missing required fields: eventId, eventType, officerId, timestamp');
        }

        // Check if event already exists
        const existingEvent = await ctx.stub.getState(eventId);
        if (existingEvent && existingEvent.length > 0) {
            throw new Error(`Event with ID ${eventId} already exists`);
        }

        // Create event object
        const event = {
            eventId,
            eventType,
            officerId,
            timestamp,
            alertId: alertId || '',
            complaintId: complaintId || '',
            actionType: actionType || '',
            metadata: metadata || '{}',
            txId: ctx.stub.getTxID(),
            txTimestamp: ctx.stub.getTxTimestamp(),
        };

        // Store event
        await ctx.stub.putState(eventId, Buffer.from(JSON.stringify(event)));

        // Create composite keys for efficient querying
        const officerKey = ctx.stub.createCompositeKey('officer~event', [officerId, eventId]);
        await ctx.stub.putState(officerKey, Buffer.from(eventId));
        
        const typeKey = ctx.stub.createCompositeKey('type~event', [eventType, eventId]);
        await ctx.stub.putState(typeKey, Buffer.from(eventId));
        
        const timestampKey = ctx.stub.createCompositeKey('timestamp~event', [timestamp, eventId]);
        await ctx.stub.putState(timestampKey, Buffer.from(eventId));

        if (alertId) {
            const alertKey = ctx.stub.createCompositeKey('alert~event', [alertId, eventId]);
            await ctx.stub.putState(alertKey, Buffer.from(eventId));
        }

        if (complaintId) {
            const complaintKey = ctx.stub.createCompositeKey('complaint~event', [complaintId, eventId]);
            await ctx.stub.putState(complaintKey, Buffer.from(eventId));
        }

        // Emit event
        ctx.stub.setEvent('AuditEventCreated', Buffer.from(JSON.stringify(event)));

        return JSON.stringify({ status: 'success', eventId, txId: event.txId });
    }

    /**
     * Query a specific audit event by ID
     */
    async QueryAuditEvent(ctx, eventId) {
        const eventBytes = await ctx.stub.getState(eventId);
        if (!eventBytes || eventBytes.length === 0) {
            throw new Error(`Event ${eventId} does not exist`);
        }
        return eventBytes.toString();
    }

    /**
     * Query all audit events for a specific officer
     */
    async QueryAuditEventsByOfficer(ctx, officerId) {
        const iterator = await ctx.stub.getStateByPartialCompositeKey('officer~event', [officerId]);
        return await this.getAllResults(iterator, ctx);
    }

    /**
     * Query all audit events by type
     */
    async QueryAuditEventsByType(ctx, eventType) {
        const iterator = await ctx.stub.getStateByPartialCompositeKey('type~event', [eventType]);
        return await this.getAllResults(iterator, ctx);
    }

    /**
     * Query audit events by date range
     */
    async QueryAuditEventsByDateRange(ctx, startDate, endDate) {
        const iterator = await ctx.stub.getStateByRange('', '');
        const results = [];
        
        while (true) {
            const res = await iterator.next();
            if (res.value && res.value.value.toString()) {
                const event = JSON.parse(res.value.value.toString());
                if (event.timestamp >= startDate && event.timestamp <= endDate) {
                    results.push(event);
                }
            }
            if (res.done) {
                await iterator.close();
                break;
            }
        }

        return JSON.stringify(results);
    }

    /**
     * Query audit events by alert ID
     */
    async QueryAuditEventsByAlert(ctx, alertId) {
        const iterator = await ctx.stub.getStateByPartialCompositeKey('alert~event', [alertId]);
        return await this.getAllResults(iterator, ctx);
    }

    /**
     * Query audit events by complaint ID
     */
    async QueryAuditEventsByComplaint(ctx, complaintId) {
        const iterator = await ctx.stub.getStateByPartialCompositeKey('complaint~event', [complaintId]);
        return await this.getAllResults(iterator, ctx);
    }

    /**
     * Get all events (for testing/admin purposes)
     */
    async GetAllAuditEvents(ctx) {
        const iterator = await ctx.stub.getStateByRange('', '');
        return await this.getAllResults(iterator, ctx);
    }


    /**
     * Helper: Get all results from iterator
     */
    async getAllResults(iterator, ctx) {
        const results = [];
        while (true) {
            const res = await iterator.next();
            if (res.value && res.value.value.toString()) {
                const eventId = res.value.value.toString();
                const eventBytes = await ctx.stub.getState(eventId);
                if (eventBytes && eventBytes.length > 0) {
                    results.push(JSON.parse(eventBytes.toString()));
                }
            }
            if (res.done) {
                await iterator.close();
                break;
            }
        }
        return JSON.stringify(results);
    }
}

module.exports = AuditTrailContract;


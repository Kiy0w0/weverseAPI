const Joi = require('joi');
const { schemas } = require('../lib/validator');

describe('Validator Schemas', () => {
    describe('login schema', () => {
        it('should validate a valid login payload', () => {
            const payload = {
                email: 'test@example.com',
                password: 'password123'
            };
            const { error } = schemas.login.validate(payload);
            expect(error).toBeUndefined();
        });

        it('should reject invalid email', () => {
            const payload = {
                email: 'invalid-email',
                password: 'password123'
            };
            const { error } = schemas.login.validate(payload);
            expect(error).toBeDefined();
        });

        it('should reject short password', () => {
            const payload = {
                email: 'test@example.com',
                password: '123'
            };
            const { error } = schemas.login.validate(payload);
            expect(error).toBeDefined();
        });

        it('should require both fields', () => {
            const payload = {
                email: 'test@example.com'
            };
            const { error } = schemas.login.validate(payload);
            expect(error).toBeDefined();
        });
    });

    describe('pagination schema', () => {
        it('should validate valid pagination params', () => {
            const params = {
                page: 2,
                size: 50
            };
            const { error } = schemas.pagination.validate(params);
            expect(error).toBeUndefined();
        });

        it('should use default values', () => {
            const params = {};
            const { value, error } = schemas.pagination.validate(params);
            expect(error).toBeUndefined();
            expect(value.page).toBe(1);
            expect(value.size).toBe(20);
        });

        it('should reject invalid page numbers', () => {
            const params = {
                page: 0
            };
            const { error } = schemas.pagination.validate(params);
            expect(error).toBeDefined();
        });

        it('should reject size larger than 100', () => {
            const params = {
                size: 101
            };
            const { error } = schemas.pagination.validate(params);
            expect(error).toBeDefined();
        });
    });

    describe('communityId schema', () => {
        it('should validate valid communityId', () => {
            const params = {
                communityId: '12345'
            };
            const { error } = schemas.communityId.validate(params);
            expect(error).toBeUndefined();
        });

        it('should require communityId', () => {
            const params = {};
            const { error } = schemas.communityId.validate(params);
            expect(error).toBeDefined();
        });
    });
});

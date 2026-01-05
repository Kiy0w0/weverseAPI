const weverseClient = require('../lib/weverseClient');
const axios = require('axios');

// 1. Definisikan mock secara in-line di dalam factory function.
// Masalah sebelumnya adalah hoisting variable. Jest me-hoist call jest.mock() ke paling atas,
// sebelum variable 'mockAxiosInstance' didefinisikan.
// Solusinya adalah mendefinisikan struktur mock langsung di dalam factory, atau menggunakan var (bukan const) dengan nama diawali "mock".
// Tapi cara paling aman dan bersih adalah menggunakan closure variable di dalam factory.

jest.mock('axios', () => {
    const mockInstance = {
        get: jest.fn(),
        post: jest.fn(),
        defaults: { headers: { common: {} } },
        interceptors: {
            request: { use: jest.fn() },
            response: { use: jest.fn() }
        }
    };

    return {
        create: jest.fn(() => mockInstance),
        get: jest.fn(),
        post: jest.fn(),
        // Expose mockInstance so tests can access it via require('axios')._mockInstance
        _mockInstance: mockInstance
    };
});

describe('WeverseClient', () => {
    let mockAxiosInstance;

    beforeAll(() => {
        // Ambil referensi ke mock instance yang dibuat oleh factory
        mockAxiosInstance = require('axios')._mockInstance;
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('getCommunities', () => {
        it('should fetch communities successfully', async () => {
            const mockData = [{ id: 1, name: 'BTS' }];
            mockAxiosInstance.get.mockResolvedValue({ data: mockData });

            const result = await weverseClient.getCommunities();

            expect(result).toEqual(mockData);
            expect(mockAxiosInstance.get).toHaveBeenCalledWith('/v1/communities');
        });

        it('should handle errors', async () => {
            const errorMessage = 'Network Error';
            mockAxiosInstance.get.mockRejectedValue(new Error(errorMessage));

            await expect(weverseClient.getCommunities()).rejects.toThrow(`Failed to get communities: ${errorMessage}`);
        });
    });



    describe('getPost', () => {
        it('should fetch single post successfully', async () => {
            const mockData = { id: 'post-1' };
            mockAxiosInstance.get.mockResolvedValue({ data: mockData });

            const result = await weverseClient.getPost('post-1');
            expect(result).toEqual(mockData);
            expect(mockAxiosInstance.get).toHaveBeenCalledWith('/v1/post/post-1');
        });
    });

    describe('getPosts', () => {
        it('should fetch posts successfully with default pagination', async () => {
            const mockData = { data: [], paging: {} };
            mockAxiosInstance.get.mockResolvedValue({ data: mockData });
            const communityId = '12345';

            const result = await weverseClient.getPosts(communityId);

            expect(result).toEqual(mockData);
            expect(mockAxiosInstance.get).toHaveBeenCalledWith(`/v1/community/${communityId}/posts`, {
                params: { page: 1, size: 20, sort: 'RECENT' }
            });
        });

        it('should fetch posts with artist filter', async () => {
            const mockData = { data: [] };
            mockAxiosInstance.get.mockResolvedValue({ data: mockData });

            await weverseClient.getPosts('123', 1, 20, 'artist');

            expect(mockAxiosInstance.get).toHaveBeenCalledWith(
                expect.stringContaining('123'),
                expect.objectContaining({
                    params: { page: 1, size: 20, sort: 'RECENT', type: 'ARTIST' }
                })
            );
        });

        it('should fetch posts with custom pagination', async () => {
            const mockData = { data: [] };
            mockAxiosInstance.get.mockResolvedValue({ data: mockData });
            const communityId = '12345';

            await weverseClient.getPosts(communityId, 2, 50);

            expect(mockAxiosInstance.get).toHaveBeenCalledWith(
                expect.stringContaining(communityId),
                expect.objectContaining({
                    params: { page: 2, size: 50, sort: 'RECENT' }
                })
            );
        });
    });

    describe('getComments', () => {
        it('should fetch comments successfully', async () => {
            const mockData = { data: [] };
            mockAxiosInstance.get.mockResolvedValue({ data: mockData });
            const postId = 'post-123';

            const result = await weverseClient.getComments(postId);

            expect(result).toEqual(mockData);
            expect(mockAxiosInstance.get).toHaveBeenCalledWith(`/v1/post/${postId}/comments`, {
                params: { page: 1, size: 20, sort: 'RECENT' }
            });
        });
    });
});

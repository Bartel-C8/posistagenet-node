import { packetHeader } from './packetHeader'
import { psn } from './types'
import { getUsedSize } from './utils/getUsedSize'
import { wrapChunk } from './wrapChunk'

export const encodeDataPacket = (
	timestamp: number,
	frame: number,
	system: psn.System,
	trackerList: psn.Tracker[],
) => {

	const packetHeaderChunk = wrapChunk(
		packetHeader(timestamp, frame, 1, system),
		psn.DATA_PACKET.CHUNKS.HEADER,
		false,
	)

	const packets: Buffer[] = []

	const initialUsedBytes = packetHeaderChunk.byteLength
		+ 4 /* PSN_DATA_PACKAGE (header) */
		+ 4 /* PSN_DATA_TRACKER_LIST (header) */
		+ 4 /* PSN_DATA_TRACKER (header) */

	let trackerChunkList: Buffer[] = []
	trackerList.forEach(t => {
		const trackerChunk = wrapChunk(
			trackerDataChunks(t),
			t.id,
			true,
		)

		const totalSize = initialUsedBytes + getUsedSize(trackerChunkList) + trackerChunk.byteLength
		if (totalSize > psn.MAX_PACKET_SIZE) {

			packets.push(createDataPacket(
				packetHeaderChunk,
				trackerChunkList,
			))

			trackerChunkList = [trackerChunk]
			return
		}

		trackerChunkList.push(trackerChunk)
	})

	packets.push(createDataPacket(
		packetHeaderChunk,
		trackerChunkList,
	))

	return packets
}

const trackerDataChunks = (tracker: psn.Tracker): Buffer[] => {
	// NOTE(kb): chunk ids are hard coded for now
	return [
		vecToChunk(tracker.position, 0x0000),
		vecToChunk(tracker.speed, 0x0001),
		vecToChunk(tracker.orientation, 0x0002),
		wrapChunk(Buffer.from([1]), 0x0003, false),
		vecToChunk(tracker.acceleration, 0x0004),
		vecToChunk(tracker.target, 0x0005),
	]
}

const vecToChunk = (vec: psn.Vector3, chunkId: number): Buffer => {
	return wrapChunk(
		Buffer.from(new Float32Array([vec.x, vec.y, vec.z])),
		chunkId,
		false,
	)
}

function createDataPacket(
	infoPacketHeaderChunk: Buffer,
	trackerChunkList: Buffer[],
) {

	const trackerListChunk = wrapChunk(
		trackerChunkList,
		psn.DATA_PACKET.CHUNKS.TRACKER_LIST,
		true,
	)

	const packet = wrapChunk(
		[infoPacketHeaderChunk, trackerListChunk],
		psn.DATA_PACKET.HEADER,
		true,
	)

	return packet
}
